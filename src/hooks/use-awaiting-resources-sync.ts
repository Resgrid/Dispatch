import { useEffect, useRef } from 'react';

import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/**
 * Keeps the calls-awaiting-resources list (and the response code catalog) current for the whole signed-in shell, so the
 * banner and the menu badge are right on every screen: loaded once the app is ready, again whenever it comes back to
 * the foreground (pushes were missed while it was away), and after every calls push (a call closed elsewhere stops
 * awaiting), which includes the nudge the update hub sends when it rejoins after an outage. The
 * `outstandingRequirementsUpdated` push itself refreshes it through the SignalR store.
 *
 * Inert, and the list emptied, while the department does not have Dispatch.RunCardConditions.
 */
export const useAwaitingResourcesSync = (isReady: boolean) => {
  const isEnabled = useIsRunCardConditionsEnabled();
  const { isActive } = useAppLifecycle();
  const lastCallsUpdateTimestamp = useSignalRStore((state) => state.lastCallsUpdateTimestamp);
  const shouldSync = isReady && isEnabled;

  useEffect(() => {
    if (!shouldSync) {
      // The flag went off (or the session is not ready): nothing may stay on screen from before.
      if (!isEnabled) {
        useAwaitingResourcesStore.getState().reset();
      }
      return;
    }

    void useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    void useAwaitingResourcesStore.getState().fetchResponseCodes();
  }, [shouldSync, isEnabled]);

  const wasActive = useRef(isActive);
  useEffect(() => {
    const resumed = isActive && !wasActive.current;
    wasActive.current = isActive;

    if (resumed && shouldSync) {
      void useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    }
  }, [isActive, shouldSync]);

  const lastSeenCallsUpdate = useRef(lastCallsUpdateTimestamp);
  useEffect(() => {
    if (lastCallsUpdateTimestamp === lastSeenCallsUpdate.current) {
      return;
    }
    lastSeenCallsUpdate.current = lastCallsUpdateTimestamp;

    // A calls push can take a call off the list (closed, or a unit added another way). The same timestamp is bumped
    // when the update hub rejoins after an outage, which replays nothing: an outstandingRequirementsUpdated sent during
    // the gap is lost, so refetch even while nothing is waiting.
    if (shouldSync) {
      void useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    }
  }, [lastCallsUpdateTimestamp, shouldSync]);
};
