import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUsersRights } from '@/api/security/security';
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
