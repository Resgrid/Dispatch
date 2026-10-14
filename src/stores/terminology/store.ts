import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getTerminology } from '@/api/config/terminology';
import { logger } from '@/lib/logging';

import { zustandStorage } from '../../lib/storage';
import useAuthStore from '../auth/store';
import { securityStore } from '../security/store';

// Term keys the department can rename (Department -> Terminology). Keep in sync with Resgrid.Model.DepartmentTerms.
export const TermKeys = {
  Calls: 'module.calls',
  Personnel: 'module.personnel',
  Units: 'module.units',
  Contacts: 'module.contacts',
  Mapping: 'module.mapping',
  Shifts: 'module.shifts',
  Records: 'module.records',
  Logs: 'module.logs',
  Reports: 'module.reports',
  Documents: 'module.documents',
  Calendar: 'module.calendar',
  Notes: 'module.notes',
  Trainings: 'module.trainings',
  Inventory: 'module.inventory',
  Readiness: 'module.readiness',
  WorkOrders: 'module.work-orders',
  Checklists: 'module.checklists',
  WorkforceBusiness: 'module.workforce-business',
} as const;

const RECORD_TYPE_PREFIX = 'record-type.';
const SYSTEM_DEFINITION_PREFIX = 'system.';

// RmsOperationalRecordType / LogTypes numbers -> the locked definition key they belong to.
const RECORD_TYPE_DEFINITIONS: Record<number, string> = {
  1: 'system.run',
  2: 'system.training',
  4: 'system.work',
  5: 'system.meeting',
  6: 'system.coroner',
  7: 'system.callback',
  8: 'system.unit-activity',
};

/** The term key for a built-in definition ("system.run" -> "record-type.run"); null for a department definition. */
export const definitionTermKey = (definitionKey?: string | null): string | null =>
  definitionKey && definitionKey.startsWith(SYSTEM_DEFINITION_PREFIX) ? RECORD_TYPE_PREFIX + definitionKey.substring(SYSTEM_DEFINITION_PREFIX.length) : null;

/** The term key for a record (or legacy log) type number; null when the number is not a built-in type. */
export const recordTypeTermKey = (recordType?: number | null): string | null => (recordType != null && RECORD_TYPE_DEFINITIONS[recordType] ? definitionTermKey(RECORD_TYPE_DEFINITIONS[recordType]) : null);

// Immutable ids only (user id + department id): names belong to one department.
const getCurrentIdentityKey = (): string | null => {
  const userId = useAuthStore.getState().userId;
  const departmentId = securityStore.getState().rights?.DepartmentId;
  if (!userId || !departmentId) {
    return null;
  }
  return `${userId}:${departmentId}`;
};

// True only when the persisted names provably belong to a different account/department.
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

export interface TerminologyState {
  /** Term key -> the department's own name. Only renamed terms are present. */
  names: Record<string, string>;
  isLoaded: boolean;
  error: string | null;
  identityKey: string | null;
  fetchTerminology: () => Promise<void>;
}

export const terminologyStore = create<TerminologyState>()(
  persist(
    (set, get) => ({
      names: {},
      isLoaded: false,
      error: null,
      identityKey: null,
      fetchTerminology: async () => {
        const identityKey = getCurrentIdentityKey();
        if (isPersistedIdentityStale(get().identityKey)) {
          // Another account's or department's words must never label this one's screens.
          set({ names: {}, isLoaded: false, identityKey: null });
        }
        try {
          const response = await getTerminology();
          const names: Record<string, string> = {};
          for (const term of response?.Data ?? []) {
            const name = term?.Name?.trim();
            if (term?.Key && name) {
              names[term.Key] = name;
            }
          }
          set({ names, isLoaded: true, error: null, identityKey });
        } catch (error) {
          // Labels only: keep the persisted names (or the app's own) when offline or on an older server.
          logger.error({
            message: 'Failed to fetch department terminology',
            context: { error },
          });
          set({ error: error instanceof Error ? error.message : 'Failed to fetch department terminology', isLoaded: true });
        }
      },
    }),
    {
      name: 'terminology-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ names: state.names, identityKey: state.identityKey }),
    }
  )
);

/** Non-reactive lookup: the department's name for a term, else `fallback` (the app's own, translated name). */
export const getTerm = (key: string | null | undefined, fallback: string): string => (key ? terminologyStore.getState().names[key] : undefined) || fallback;

/** Reactive: the department's name for a term, else `fallback` (the app's own, translated name). */
export const useTerm = (key: string | null | undefined, fallback: string): string => terminologyStore((state) => (key ? state.names[key] : undefined)) || fallback;

/** Reactive: a record type's name by its number, else `fallback`. */
export const useRecordTypeTerm = (recordType: number | null | undefined, fallback: string): string => useTerm(recordTypeTermKey(recordType), fallback);

/** Reactive: a definition's name by its key; department definitions (and unrenamed types) show `fallback`. */
export const useDefinitionTerm = (definitionKey: string | null | undefined, fallback: string): string => useTerm(definitionTermKey(definitionKey), fallback);
