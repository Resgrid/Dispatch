import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/lib/logging';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { useAppLifecycle } from './use-app-lifecycle';

interface UseSignalRLifecycleOptions {
  isSignedIn: boolean;
  hasInitialized: boolean;
}

export function useSignalRLifecycle({ isSignedIn, hasInitialized }: UseSignalRLifecycleOptions) {
  const { isActive, appState } = useAppLifecycle();
  const signalRStore = useSignalRStore();

  // Track current values with refs for timer callbacks
  const currentIsActive = useRef(isActive);
  const currentAppState = useRef(appState);
  const currentIsSignedIn = useRef(isSignedIn);
  const currentHasInitialized = useRef(hasInitialized);

  // Update refs whenever values change
  useEffect(() => {
    currentIsActive.current = isActive;
    currentAppState.current = appState;
    currentIsSignedIn.current = isSignedIn;
    currentHasInitialized.current = hasInitialized;
  }, [isActive, appState, isSignedIn, hasInitialized]);

  const lastAppState = useRef<string | null>(null);
  const isProcessing = useRef(false);
  const pendingOperations = useRef<AbortController | null>(null);
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAppBackground = useCallback(async () => {
    logger.debug({
      message: 'handleAppBackground called',
      context: { isSignedIn: currentIsSignedIn.current, hasInitialized: currentHasInitialized.current, isProcessing: isProcessing.current },
    });

    if (!currentIsSignedIn.current || !currentHasInitialized.current || isProcessing.current) {
      logger.debug({
        message: 'Skipping SignalR disconnect - conditions not met',
        context: { isSignedIn: currentIsSignedIn.current, hasInitialized: currentHasInitialized.current, isProcessing: isProcessing.current },
      });
      return;
    }

    // Cancel any pending operations
    if (pendingOperations.current) {
      pendingOperations.current.abort();
    }

    isProcessing.current = true;
    const controller = new AbortController();
    pendingOperations.current = controller;

    logger.info({
      message: 'App going to background, disconnecting SignalR',
    });

    try {
      // Use Promise.allSettled to prevent one failure from blocking the other
      const hubNames = ['UpdateHub', 'GeolocationHub', 'ChatHub'];
      const results = await Promise.allSettled([signalRStore.disconnectUpdateHub(), signalRStore.disconnectGeolocationHub(), signalRStore.disconnectChatHub()]);

      // Log any failures without throwing
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error({
            message: `Failed to disconnect ${hubNames[index]} on app background`,
            context: { error: result.reason },
          });
        }
      });
    } catch (error) {
      logger.error({
        message: 'Unexpected error during SignalR disconnect on app background',
        context: { error },
      });
    } finally {
      if (controller === pendingOperations.current) {
        isProcessing.current = false;
        pendingOperations.current = null;
      }
    }
  }, [signalRStore]);

  const handleAppResume = useCallback(async () => {
    logger.debug({
      message: 'handleAppResume called',
      context: { isSignedIn: currentIsSignedIn.current, hasInitialized: currentHasInitialized.current, isProcessing: isProcessing.current },
    });

    if (!currentIsSignedIn.current || !currentHasInitialized.current || isProcessing.current) {
      logger.debug({
        message: 'Skipping SignalR reconnect - conditions not met',
        context: { isSignedIn: currentIsSignedIn.current, hasInitialized: currentHasInitialized.current, isProcessing: isProcessing.current },
      });
      return;
    }

    // Cancel any pending operations
    if (pendingOperations.current) {
      pendingOperations.current.abort();
    }

    isProcessing.current = true;
    const controller = new AbortController();
    pendingOperations.current = controller;

    logger.info({
      message: 'App resumed from background, reconnecting SignalR',
    });

    try {
      // Use Promise.allSettled to prevent one failure from blocking the other
      const hubNames = ['UpdateHub', 'GeolocationHub', 'ChatHub'];
      const results = await Promise.allSettled([signalRStore.connectUpdateHub(), signalRStore.connectGeolocationHub(), signalRStore.connectChatHub()]);

      // Log any failures without throwing
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error({
            message: `Failed to reconnect ${hubNames[index]} on app resume`,
            context: { error: result.reason },
          });
        }
      });
    } catch (error) {
      logger.error({
        message: 'Unexpected error during SignalR reconnect on app resume',
        context: { error },
      });
    } finally {
      if (controller === pendingOperations.current) {
        isProcessing.current = false;
        pendingOperations.current = null;
      }
    }
  }, [signalRStore]);

  // Clear timers helper
  const clearTimers = useCallback(() => {
    if (backgroundTimer.current) {
      clearTimeout(backgroundTimer.current);
      backgroundTimer.current = null;
    }
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  // Handle app going to background with extended debounce to prevent navigation-triggered disconnects
  useEffect(() => {
    // Only proceed if all prerequisites are met
    if (!isSignedIn || !hasInitialized) {
      return;
    }

    // Clear existing timers on state change
    clearTimers();

    // Handle background/inactive states
    if (!isActive && (appState === 'background' || appState === 'inactive')) {
      logger.debug({
        message: 'App state changed to background/inactive, starting disconnect timer',
        context: { appState, isActive },
      });

      // Use extended debounce (2 seconds) to prevent rapid navigation changes from triggering disconnects
      backgroundTimer.current = setTimeout(() => {
        // Re-check the current state values to ensure we're still in background
        if (!currentIsActive.current && (currentAppState.current === 'background' || currentAppState.current === 'inactive')) {
          logger.info({
            message: 'App confirmed in background state, proceeding with SignalR disconnect',
            context: { appState: currentAppState.current, isActive: currentIsActive.current },
          });
          handleAppBackground();
        } else {
          logger.debug({
            message: 'App state changed during disconnect timer, cancelling disconnect',
            context: { appState: currentAppState.current, isActive: currentIsActive.current },
          });
        }
      }, 2000); // 2 second delay
    }

    return clearTimers;
  }, [isActive, appState, isSignedIn, hasInitialized, handleAppBackground, clearTimers]);

  // Handle app resuming from background
  useEffect(() => {
    // Only proceed if all prerequisites are met
    if (!isSignedIn || !hasInitialized) {
      return;
    }

    // Clear existing timers on state change
    clearTimers();

    // Handle resume if becoming active from background/inactive
    if (isActive && appState === 'active') {
      const wasInBackground = lastAppState.current === 'background' || lastAppState.current === 'inactive';
      const isStateChange = lastAppState.current !== 'active';

      if (wasInBackground && isStateChange) {
        logger.debug({
          message: 'App resumed from background, starting reconnect timer',
          context: { previousState: lastAppState.current, currentState: appState },
        });

        // Use shorter delay for resume to reconnect quickly
        resumeTimer.current = setTimeout(() => {
          // Re-check the current state values
          if (currentIsActive.current && currentAppState.current === 'active') {
            logger.info({
              message: 'App confirmed active from background, proceeding with SignalR reconnect',
              context: { previousState: lastAppState.current, currentState: currentAppState.current },
            });
            handleAppResume();
          } else {
            logger.debug({
              message: 'App state changed during reconnect timer, cancelling reconnect',
              context: { appState: currentAppState.current, isActive: currentIsActive.current },
            });
          }
        }, 1000); // 1 second delay for resume
      }
    }

    // Update last app state
    lastAppState.current = appState;

    return clearTimers;
  }, [isActive, appState, isSignedIn, hasInitialized, handleAppResume, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (pendingOperations.current) {
        pendingOperations.current.abort();
        pendingOperations.current = null;
      }
      isProcessing.current = false;
    };
  }, [clearTimers]);

  return {
    isActive,
    appState,
    handleAppBackground,
    handleAppResume,
  };
}
