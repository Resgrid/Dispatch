import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useAppLifecycleStore } from '@/stores/app/app-lifecycle';

export const useAppLifecycle = () => {
  // On web, return static values to avoid store subscription overhead
  // Use useMemo to ensure stable object reference
  const staticWebValues = useMemo(
    () => ({
      appState: 'active' as const,
      isActive: true,
      isBackground: false,
      lastActiveTimestamp: null,
    }),
    []
  );

  // On native platforms, subscribe to the store. Selected field by field and reassembled
  // with useMemo: an object selector builds a new reference on every store write, so every
  // consumer of this hook re-rendered whether or not these four values changed — the same
  // stable-reference concern the web branch above already handles.
  const appState = useAppLifecycleStore((state) => state.appState);
  const isActive = useAppLifecycleStore((state) => state.isActive);
  const isBackground = useAppLifecycleStore((state) => state.isBackground);
  const lastActiveTimestamp = useAppLifecycleStore((state) => state.lastActiveTimestamp);

  const storeValues = useMemo(() => ({ appState, isActive, isBackground, lastActiveTimestamp }), [appState, isActive, isBackground, lastActiveTimestamp]);

  // Choose which values to return based on platform
  const values = Platform.OS === 'web' ? staticWebValues : storeValues;

  useEffect(() => {
    // Skip effect on web platform
    if (Platform.OS === 'web') {
      return;
    }

    // You can add any side effects based on app state changes here
    // For example, you might want to pause/resume certain operations
    // when the app goes to background/foreground
  }, [values.appState]);

  return values;
};
