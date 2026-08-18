import { useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { isCallActive } from '@/lib/utils';
import useAuthStore from '@/stores/auth/store';
import { useCallsStore } from '@/stores/calls/store';
import { type CheckInPollingOwner, useCheckInStore } from '@/stores/checkIn/store';

/**
 * Shared driver for the dispatch console's check-in timer poll.
 *
 * Two console panels read `timerStatuses` — the activity log's check-in tab and the overdue
 * badges on the active-calls cards — and each poll round costs a request per call. Owning the
 * interval in one panel meant it ran for whoever mounted first, kept running when that panel was
 * collapsed, and stopped when it unmounted even though the other panel still needed the data.
 *
 * Consumers instead declare interest here. The interval runs while at least one enabled consumer
 * is mounted and the app is in the foreground, over the union of the call ids they care about.
 * Coming back to the foreground refetches immediately rather than waiting out the interval.
 *
 * The underlying store keeps a single interval (`_pollingInterval`), so a screen that drives its
 * own poll — the call-detail check-in tab via `startPolling` — still takes over while it is
 * mounted. The console sits underneath in the stack and stays mounted through that visit, so it
 * watches `_pollingOwner` to notice both the takeover and the hand-back: the detail screen's
 * cleanup stops (and then resets) the store, and without reclaiming afterwards the console would
 * keep believing it was polling while no interval existed at all.
 */

const POLL_INTERVAL_MS = 30000;

// Interest registry. Keyed by a per-hook token so two consumers can want different call sets.
const subscribers = new Map<symbol, number[]>();

let desiredCallIds: number[] = [];
let runningKey: string | null = null;
let isForeground = true;
let isReconciling = false;
let unbindForeground: (() => void) | null = null;
let unsubscribeOwner: (() => void) | null = null;

function isBackgroundState(state: AppStateStatus | null | undefined): boolean {
  return state === 'background' || state === 'inactive';
}

function recomputeDesired(): void {
  const union = new Set<number>();
  subscribers.forEach((ids) => {
    ids.forEach((id) => union.add(id));
  });
  desiredCallIds = [...union].sort((a, b) => a - b);
}

function reconcile(): void {
  // Our own stop/start pair moves `_pollingOwner`, which notifies the subscription below.
  if (isReconciling) return;

  const store = useCheckInStore.getState();
  const shouldPoll = subscribers.size > 0 && isForeground && desiredCallIds.length > 0;
  const nextKey = shouldPoll ? desiredCallIds.join(',') : null;
  const ownsInterval = store._pollingOwner === 'console' && store._pollingInterval !== null;

  // `runningKey` on its own is not proof the interval exists: the call-detail screen replaces it
  // on the way in and clears it on the way out, so a cached key would let the console early-return
  // forever with nothing actually polling.
  if (nextKey === runningKey && (nextKey === null || ownsInterval)) return;

  isReconciling = true;
  try {
    // Only ever stop an interval that is ours — the call-detail screen's poll is not the console's
    // to cancel.
    if (runningKey !== null && ownsInterval) {
      store.stopPolling();
    }

    runningKey = nextKey;
    if (nextKey === null) return;

    // Fetch up front so a resumed or newly-widened poll shows current data instead of waiting a
    // full interval. Not silent: this is the round a spinner should be allowed to cover.
    void store.fetchTimerStatusesForCalls(desiredCallIds);
    store.startPollingForCalls(desiredCallIds, POLL_INTERVAL_MS);
  } finally {
    isReconciling = false;
  }
}

function handleOwnerChange(owner: CheckInPollingOwner | null, previousOwner: CheckInPollingOwner | null): void {
  if (owner === previousOwner) return;

  if (owner === 'call-detail') {
    // Preempted. Give up the claim so the next reconcile rebuilds instead of trusting a key whose
    // interval now belongs to another screen — and stop nothing, that interval is not ours.
    runningKey = null;
    return;
  }

  // Only a release is worth acting on; someone else starting a poll is handled above.
  if (owner !== null) return;
  if (isReconciling) return;

  // Sign-out tears the poll down through this same path (see `teardownSignedInSession`). Reclaiming
  // then would put the console back to polling against a session that no longer exists.
  if (useAuthStore.getState().status !== 'signedIn') return;

  reconcile();
}

function bindOwnerWatcher(): void {
  if (unsubscribeOwner) return;
  unsubscribeOwner = useCheckInStore.subscribe((state, previousState) => {
    handleOwnerChange(state._pollingOwner, previousState._pollingOwner);
  });
}

function bindForegroundWatcher(): void {
  if (unbindForeground) return;

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      isForeground = true;
      unbindForeground = () => undefined;
      return;
    }
    const onVisibilityChange = () => {
      isForeground = !document.hidden;
      reconcile();
    };
    isForeground = !document.hidden;
    document.addEventListener('visibilitychange', onVisibilityChange);
    unbindForeground = () => document.removeEventListener('visibilitychange', onVisibilityChange);
    return;
  }

  // Only an explicitly backgrounded state pauses the poll. `AppState.currentState` is undefined
  // until the platform reports in, and treating that as "not active" would leave a foregrounded
  // app waiting for a change event that never arrives.
  isForeground = !isBackgroundState(AppState.currentState);
  const subscription = AppState.addEventListener('change', (nextState) => {
    isForeground = !isBackgroundState(nextState);
    reconcile();
  });
  // Optional call: `addEventListener` only started returning a subscription in newer React Native,
  // and an unbind that throws would strand the watcher bound for the rest of the process.
  unbindForeground = () => subscription?.remove();
}

function releaseWatchers(): void {
  if (subscribers.size > 0) return;

  if (unbindForeground) {
    unbindForeground();
    unbindForeground = null;
  }
  if (unsubscribeOwner) {
    unsubscribeOwner();
    unsubscribeOwner = null;
  }
  isForeground = true;
}

/**
 * Declare that this component needs check-in timer statuses for the currently active calls.
 *
 * @param enabled Whether the consumer is actually showing that data right now — pass `false`
 *   when its panel is collapsed so a hidden panel stops paying for the poll.
 */
export function useCheckInTimerPolling(enabled: boolean): void {
  const calls = useCallsStore((s) => s.calls);

  // Only active calls have running timers; polling every call in the store meant closed calls
  // kept costing a request per round.
  const callIds = useMemo(
    () =>
      calls
        .filter((c) => isCallActive(c.State))
        .map((c) => parseInt(c.CallId, 10))
        .filter((id) => !isNaN(id) && id > 0)
        .sort((a, b) => a - b),
    [calls]
  );

  // Order-independent identity so a SignalR refresh that returns the same calls in a new array
  // does not tear the interval down and back up.
  const callIdsKey = callIds.join(',');

  useEffect(() => {
    if (!enabled || callIdsKey === '') return;

    const token = Symbol('check-in-timer-polling');
    bindForegroundWatcher();
    bindOwnerWatcher();
    subscribers.set(token, callIdsKey.split(',').map(Number));
    recomputeDesired();
    reconcile();

    return () => {
      subscribers.delete(token);
      recomputeDesired();
      reconcile();
      releaseWatchers();
    };
  }, [enabled, callIdsKey]);
}

/** Test seam: drop all registered interest and stop the interval. */
export function resetCheckInTimerPolling(): void {
  subscribers.clear();
  recomputeDesired();
  if (runningKey !== null) {
    useCheckInStore.getState().stopPolling();
    runningKey = null;
  }
  if (unbindForeground) {
    unbindForeground();
    unbindForeground = null;
  }
  if (unsubscribeOwner) {
    unsubscribeOwner();
    unsubscribeOwner = null;
  }
  isForeground = true;
  isReconciling = false;
}
