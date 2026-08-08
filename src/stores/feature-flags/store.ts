import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getAllFeatureFlags } from '@/api/feature-flags/feature-flags';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';

// Well-known feature flag keys. Keep values in sync with Resgrid.Model.FeatureFlagKeys.
export const FeatureFlagKeys = {
  ChatSystem: 'Chat.System',
} as const;

export type FeatureFlagKey = (typeof FeatureFlagKeys)[keyof typeof FeatureFlagKeys];

interface FeatureFlagEntry {
  enabled: boolean;
  value?: string | null;
}

export interface FeatureFlagsState {
  flags: Record<string, FeatureFlagEntry>;
  isLoaded: boolean;
  error: string | null;
  fetchFlags: () => Promise<void>;
  isEnabled: (key: string, defaultValue?: boolean) => boolean;
}

export const featureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: {},
      isLoaded: false,
      error: null,
      fetchFlags: async () => {
        try {
          const response = await getAllFeatureFlags();
          const flags: Record<string, FeatureFlagEntry> = {};
          for (const flag of response?.Data ?? []) {
            if (flag?.Key) {
              flags[flag.Key] = { enabled: !!flag.Enabled, value: flag.Value ?? null };
            }
          }
          set({ flags, isLoaded: true, error: null });
        } catch (error) {
          // Keep any persisted flags on failure so gating stays stable while offline.
          logger.error({
            message: 'Failed to fetch feature flags',
            context: { error },
          });
          set({ error: error instanceof Error ? error.message : 'Failed to fetch feature flags' });
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
