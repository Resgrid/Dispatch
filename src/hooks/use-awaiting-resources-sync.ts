import { useEffect, useRef } from 'react';

import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/**
 * Keeps the calls-awaiting-resources list (and the response code catalog) current for the whole signed-in shell, so the
 * banner and the menu badge are right on every screen: loaded once the app is ready, again whenever it comes back to
 * the foreground (pushes were missed while it was away), and after a calls push while anything is waiting (a call
 * closed elsewhere stops awaiting). The `outstandingRequirementsUpdated` push itself refreshes it through the SignalR
 * store.
 *
 * Inert, and the list emptied, while the department does not have Dispatch.RunCardConditions.
 */
export const useAwaitingResourcesSync = (isReady: boolean) => {
  const isEnabled = useIsRunCardConditionsEnabled();
  const { isActive } = useAppLifecycle();
  const lastCallsUpdateTimestamp = useSignalRStore((state) => state.lastCallsUpdateTimestamp);
  const hasAwaitingCalls = useAwaitingResourcesStore((state) => state.calls.length > 0);
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

    // A calls push can only take a call off the list (closed, or a unit added another way); new waiting calls arrive
    // as outstandingRequirementsUpdated. With nothing waiting there is nothing to take off.
    if (shouldSync && hasAwaitingCalls) {
      void useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    }
  }, [lastCallsUpdateTimestamp, shouldSync, hasAwaitingCalls]);
};
