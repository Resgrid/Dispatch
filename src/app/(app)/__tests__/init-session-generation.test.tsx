/**
 * Signing out while app initialization is still awaiting must retire that run: a stale
 * invocation may not mark the app initialized, connect the chat hub, or restart location
 * tracking that the sign-out cleanup just stopped.
 *
 * The layout itself pulls in Mapbox, Novu, push notifications and the whole store graph,
 * so the guard protocol is exercised through the same generation-token shape the layout
 * uses rather than by rendering it.
 */
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Mirrors the layout's initializeApp guard: generation captured at start, checked after each await. */
function useInitGuard(gate: Deferred, effects: { connectHub: jest.Mock; startLocation: jest.Mock; markInitialized: jest.Mock }) {
  const initGeneration = React.useRef(0);
  const isInitializing = React.useRef(false);

  const initialize = React.useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    const generation = (initGeneration.current += 1);
    const isCurrentRun = () => initGeneration.current === generation;

    try {
      await gate.promise;
      if (!isCurrentRun()) return;

      effects.connectHub();
      if (!isCurrentRun()) return;

      effects.markInitialized();
      if (!isCurrentRun()) return;

      effects.startLocation();
    } finally {
      if (isCurrentRun()) {
        isInitializing.current = false;
      }
    }
  }, [gate, effects]);

  const signOut = React.useCallback(() => {
    initGeneration.current += 1;
    isInitializing.current = false;
  }, []);

  return { initialize, signOut, isInitializing };
}

describe('app initialization session generation', () => {
  const effects = { connectHub: jest.fn(), startLocation: jest.fn(), markInitialized: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abandons an in-flight run when the session ends mid-initialization', async () => {
    const gate = deferred();
    const { result } = renderHook(() => useInitGuard(gate, effects));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.initialize();
    });

    // Sign-out lands while initialization is still awaiting its first step.
    act(() => {
      result.current.signOut();
    });

    await act(async () => {
      gate.resolve();
      await pending;
    });

    expect(effects.connectHub).not.toHaveBeenCalled();
    expect(effects.markInitialized).not.toHaveBeenCalled();
    expect(effects.startLocation).not.toHaveBeenCalled();
  });

  it('completes normally when the session survives', async () => {
    const gate = deferred();
    const { result } = renderHook(() => useInitGuard(gate, effects));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.initialize();
    });

    await act(async () => {
      gate.resolve();
      await pending;
    });

    expect(effects.connectHub).toHaveBeenCalledTimes(1);
    expect(effects.markInitialized).toHaveBeenCalledTimes(1);
    expect(effects.startLocation).toHaveBeenCalledTimes(1);
  });

  it('frees the in-progress guard so the next sign-in can initialize', async () => {
    const first = deferred();
    const { result } = renderHook(() => useInitGuard(first, effects));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.initialize();
    });
    act(() => {
      result.current.signOut();
    });

    // The new session starts before the retired run has settled.
    let second: Promise<void> = Promise.resolve();
    act(() => {
      second = result.current.initialize();
    });

    await act(async () => {
      first.resolve();
      await Promise.all([pending, second]);
    });

    // Exactly one run reached the effects: the current one.
    expect(effects.markInitialized).toHaveBeenCalledTimes(1);
    expect(effects.startLocation).toHaveBeenCalledTimes(1);
  });
});
