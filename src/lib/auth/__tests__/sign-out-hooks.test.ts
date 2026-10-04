/**
 * Sign-out hooks (lib/auth/sign-out-hooks.ts) run as the session ends, with its access token, and never hold sign-out up
 * for longer than their timeout.
 */
import { _clearSignOutHooks, registerSignOutHook, runSignOutHooks, SIGN_OUT_HOOK_TIMEOUT_MS } from '../sign-out-hooks';

afterEach(() => {
  _clearSignOutHooks();
  jest.useRealTimers();
});

describe('runSignOutHooks', () => {
  it('hands every hook the token and waits for them', async () => {
    const calls: string[] = [];
    registerSignOutHook(async (token) => {
      calls.push(`a:${token}`);
    });
    registerSignOutHook(async (token) => {
      calls.push(`b:${token}`);
    });

    await runSignOutHooks('access-token');

    expect(calls).toEqual(['a:access-token', 'b:access-token']);
  });

  it('carries on past a hook that fails', async () => {
    const after = jest.fn(async () => undefined);
    registerSignOutHook(async () => {
      throw new Error('offline');
    });
    registerSignOutHook(after);

    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();
    expect(after).toHaveBeenCalled();
  });

  it('stops waiting on a hook that never finishes', async () => {
    jest.useFakeTimers();
    registerSignOutHook(() => new Promise(() => undefined));

    const run = runSignOutHooks('access-token');
    jest.advanceTimersByTime(SIGN_OUT_HOOK_TIMEOUT_MS);

    await expect(run).resolves.toBeUndefined();
  });

  it('no longer runs a hook once it is removed', async () => {
    const hook = jest.fn(async () => undefined);
    const remove = registerSignOutHook(hook);
    remove();

    await runSignOutHooks('access-token');

    expect(hook).not.toHaveBeenCalled();
  });
});
