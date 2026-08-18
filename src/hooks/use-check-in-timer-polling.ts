import { useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { isCallActive } from '@/lib/utils';
import { useCallsStore } from '@/stores/calls/store';
import { useCheckInStore } from '@/stores/checkIn/store';

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
 * mounted; the console panels re-establish theirs on return.
 */

const POLL_INTERVAL_MS = 30000;

// Interest registry. Keyed by a per-hook token so two consumers can want different call sets.
const subscribers = new Map<symbol, number[]>();

let desiredCallIds: number[] = [];
let runningKey: string | null = null;
let isForeground = true;
let unbindForeground: (() => void) | null = null;

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
  const store = useCheckInStore.getState();
  const shouldPoll = subscribers.size > 0 && isForeground && desiredCallIds.length > 0;
  const nextKey = shouldPoll ? desiredCallIds.join(',') : null;

  if (nextKey === runningKey) return;

  if (runningKey !== null) {
    store.stopPolling();
  }

  runningKey = nextKey;
  if (nextKey === null) return;

  // Fetch up front so a resumed or newly-widened poll shows current data instead of waiting a
  // full interval. Not silent: this is the round a spinner should be allowed to cover.
  void store.fetchTimerStatusesForCalls(desiredCallIds);
  store.startPollingForCalls(desiredCallIds, POLL_INTERVAL_MS);
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
  unbindForeground = () => subscription.remove();
}

function releaseForegroundWatcher(): void {
  if (subscribers.size > 0 || !unbindForeground) return;
  unbindForeground();
  unbindForeground = null;
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
    subscribers.set(token, callIdsKey.split(',').map(Number));
    recomputeDesired();
    reconcile();

    return () => {
      subscribers.delete(token);
      recomputeDesired();
      reconcile();
      releaseForegroundWatcher();
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
  isForeground = true;
}
