import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getAllFeatureFlags } from '@/api/feature-flags/feature-flags';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';

import useAuthStore from '../auth/store';
import { securityStore } from '../security/store';

// Well-known feature flag keys. Keep values in sync with Resgrid.Model.FeatureFlagKeys.
export const FeatureFlagKeys = {
  ChatSystem: 'Chat.System',
} as const;

export type FeatureFlagKey = (typeof FeatureFlagKeys)[keyof typeof FeatureFlagKeys];

interface FeatureFlagEntry {
  enabled: boolean;
  value?: string | null;
}

// Immutable ids only (user id + department id) so renames/code changes never alias identities.
const getCurrentIdentityKey = (): string | null => {
  const userId = useAuthStore.getState().userId;
  const departmentId = securityStore.getState().rights?.DepartmentId;
  if (!userId || !departmentId) {
    return null;
  }
  return `${userId}:${departmentId}`;
};

// True only when the persisted flags provably belong to a different account/department.
// With no proof (e.g. rights unavailable offline) flags are kept so gating stays stable.
const isPersistedIdentityStale = (persistedKey: string | null): boolean => {
  if (!persistedKey) {
    return false;
  }
  const userId = useAuthStore.getState().userId;
  const departmentId = securityStore.getState().rights?.DepartmentId;
  if (userId && departmentId) {
    return persistedKey !== `${userId}:${departmentId}`;
  }
  if (userId) {
    return !persistedKey.startsWith(`${userId}:`);
  }
  return false;
};

export interface FeatureFlagsState {
  flags: Record<string, FeatureFlagEntry>;
  isLoaded: boolean;
  error: string | null;
  identityKey: string | null;
  fetchFlags: () => Promise<void>;
  isEnabled: (key: string, defaultValue?: boolean) => boolean;
}

export const featureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: {},
      isLoaded: false,
      error: null,
      identityKey: null,
      fetchFlags: async () => {
        const identityKey = getCurrentIdentityKey();
        if (isPersistedIdentityStale(get().identityKey)) {
          // Persisted flags belong to another account/department; drop them before fetching
          // so a failed fetch can never gate this identity with the previous one's flags.
          set({ flags: {}, isLoaded: false, identityKey: null });
        }
        try {
          const response = await getAllFeatureFlags();
          const flags: Record<string, FeatureFlagEntry> = {};
          for (const flag of response?.Data ?? []) {
            if (flag?.Key) {
              flags[flag.Key] = { enabled: !!flag.Enabled, value: flag.Value ?? null };
            }
          }
          set({ flags, isLoaded: true, error: null, identityKey });
        } catch (error) {
          // Keep persisted flags on failure so gating stays stable while offline; the mismatch
          // check above already cleared them if they belonged to a different identity. Marking
          // isLoaded resolves flags with no persisted entry fail-closed (disabled) instead of
          // leaving consumers waiting on 'unknown' forever.
          logger.error({
            message: 'Failed to fetch feature flags',
            context: { error },
          });
          set({ error: error instanceof Error ? error.message : 'Failed to fetch feature flags', isLoaded: true });
        }
      },
      isEnabled: (key: string, defaultValue = false) => get().flags[key]?.enabled ?? defaultValue,
    }),
    {
      name: 'feature-flags-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

// Reactive hook; components re-render when the flag changes. Unknown flags default to disabled
// so gated features stay hidden until the server confirms them.
export const useFeatureFlag = (key: string, defaultValue = false) => featureFlagsStore((state) => state.flags[key]?.enabled ?? defaultValue);

export const useIsChatEnabled = () => useFeatureFlag(FeatureFlagKeys.ChatSystem);

export type FeatureFlagStatus = 'unknown' | 'enabled' | 'disabled';

// Tri-state hook for gating that must not act before flags resolve (e.g. redirecting away
// from a deep link). 'unknown' until flags for this identity are fetched or rehydrated;
// fetch failures resolve fail-closed as 'disabled' for flags with no persisted entry.
export const useFeatureFlagStatus = (key: string): FeatureFlagStatus =>
  featureFlagsStore((state) => {
    const entry = state.flags[key];
    if (entry) {
      return entry.enabled ? 'enabled' : 'disabled';
    }
    return state.isLoaded ? 'disabled' : 'unknown';
  });

export const useChatSystemStatus = (): FeatureFlagStatus => useFeatureFlagStatus(FeatureFlagKeys.ChatSystem);
