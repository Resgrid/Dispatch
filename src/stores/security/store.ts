import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUsersRights } from '@/api/security/security';
import { setCacheScope } from '@/lib/cache/cache-scope';
import { logger } from '@/lib/logging';
import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

export interface SecurityState {
  error: string | null;
  getRights: () => Promise<void>;
  rights: DepartmentRightsResultData | null;
}

// Create MMKV storage instance for security persistence (only used on native platforms)
const securityStorage = new MMKV({
  id: 'security-storage',
  encryptionKey: Platform.OS === 'web' ? undefined : '9f066882-5c07-47a4-9bf3-783074b590d5',
});

// MMKV storage adapter for Zustand
const mmkvStorage = {
  getItem: (name: string) => {
    const value = securityStorage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    securityStorage.set(name, value);
  },
  removeItem: (name: string) => {
    securityStorage.delete(name);
  },
};

/**
 * The department half of the API cache scope. Rights are where the department id is resolved, so
 * this store owns stamping it: cache keys embed it, and without it a user who moves between
 * departments reads the previous department's cached rosters, units and contacts back out of MMKV.
 */
const applyDepartmentCacheScope = (departmentId: string | null | undefined): void => {
  try {
    setCacheScope({ departmentId: departmentId ? String(departmentId) : null });
  } catch (error) {
    // Never let cache bookkeeping break sign-in. A stale scope only costs a cache miss.
    logger.warn({
      message: 'Failed to apply the department to the API cache scope',
      context: { error },
    });
  }
};

// Base store creator without persistence
const createSecurityStore: StateCreator<SecurityState> = (set, _get) => ({
  error: null,
  rights: null,
  getRights: async () => {
    try {
      const response = await getCurrentUsersRights();

      set({
        rights: response.Data,
      });

      applyDepartmentCacheScope(response.Data?.DepartmentId);
    } catch (error) {
      logger.error({
        message: 'Failed to get user rights',
        context: { error },
      });
      // If refresh fails, log the error but don't throw
    }
  },
});

// On web, don't persist state - create store without persist middleware
// On native platforms (iOS/Android), use persist middleware with MMKV storage
export const securityStore =
  Platform.OS === 'web'
    ? create<SecurityState>()(createSecurityStore)
    : create<SecurityState>()(
        persist(createSecurityStore, {
          name: 'security-storage',
          storage: createJSONStorage(() => mmkvStorage),
          // Only persist rights data
          partialize: (state) => ({
            rights: state.rights,
          }),
        })
      );

// Rights also arrive without going through getRights — persisted rights rehydrate during store
// creation above, and a department switch lands as a plain state change. Keep the scope in step with
// whatever the rights currently say rather than only with the fetch path.
securityStore.subscribe((state, previousState) => {
  if (state.rights?.DepartmentId === previousState.rights?.DepartmentId) {
    return;
  }

  applyDepartmentCacheScope(state.rights?.DepartmentId ?? null);
});

// Rehydration finishes inside create(), before the subscription above exists, so stamp the scope
// once from whatever rights were restored.
applyDepartmentCacheScope(securityStore.getState().rights?.DepartmentId ?? null);

export const useSecurityStore = () => {
  const store = securityStore();
  return {
    getRights: store.getRights,
    isUserDepartmentAdmin: store.rights?.IsAdmin,
    isUserGroupAdmin: (groupId: number) => store.rights?.Groups?.some((right) => right.GroupId === groupId && right.IsGroupAdmin) ?? false,
    canUserCreateCalls: store.rights?.CanCreateCalls,
    canUserCreateNotes: store.rights?.CanAddNote,
    canUserCreateMessages: store.rights?.CanCreateMessage,
    canUserViewPII: store.rights?.CanViewPII,
    // Undefined (rights not loaded yet) is treated as allowed by callers; only an explicit false blocks.
    canUserWorkCommand: store.rights?.CanLoginToCommandApp,
    departmentCode: store.rights?.DepartmentCode,
    rights: store.rights,
  };
};
