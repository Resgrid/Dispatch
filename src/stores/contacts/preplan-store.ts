import { create } from 'zustand';

import { getContactFiles } from '@/api/contacts/contactFiles';
import { getContactPreplan } from '@/api/contacts/contactPreplans';
import { logger } from '@/lib/logging';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';
import { type ContactPreplanData } from '@/models/v4/contacts/contactPreplanResult';

interface ContactPreplanState {
  /** Pre-plan per contact; an explicit null means "fetched, the contact has none". */
  preplans: Record<string, ContactPreplanData | null>;
  files: Record<string, ContactFileResultData[]>;
  loadingPreplan: Record<string, boolean>;
  loadingFiles: Record<string, boolean>;
  /**
   * Per-contact fetch failures. A failed read writes no entry into `preplans` or `files`, and the
   * panels must not present that as "this contact has no pre-plan / no files" — for pre-incident
   * data a misleading empty state is worse than an error. Cleared by the next successful fetch.
   */
  preplanErrors: Record<string, string>;
  fileErrors: Record<string, string>;
  error: string | null;

  fetchPreplan: (contactId: string, force?: boolean) => Promise<void>;
  fetchFiles: (contactId: string, force?: boolean) => Promise<void>;
  invalidate: (contactId: string) => void;
  reset: () => void;
}

const withoutKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return record;
  }
  const next = { ...record };
  delete next[key];
  return next;
};

/**
 * Pre-plan and site-file cache for the contact details sheet (Contacts plan Phase A). Cached per contact
 * for the life of the sheet; `force` re-fetches after a step-up so REDACTED values are replaced.
 */
export const useContactPreplanStore = create<ContactPreplanState>((set, get) => ({
  preplans: {},
  files: {},
  loadingPreplan: {},
  loadingFiles: {},
  preplanErrors: {},
  fileErrors: {},
  error: null,

  fetchPreplan: async (contactId: string, force = false) => {
    if (!contactId) return;
    if (!force && Object.prototype.hasOwnProperty.call(get().preplans, contactId)) return;

    set((state) => ({ loadingPreplan: { ...state.loadingPreplan, [contactId]: true }, error: null }));
    try {
      const result = await getContactPreplan(contactId);
      set((state) => ({
        preplans: { ...state.preplans, [contactId]: result?.Data ?? null },
        loadingPreplan: { ...state.loadingPreplan, [contactId]: false },
        preplanErrors: withoutKey(state.preplanErrors, contactId),
      }));
    } catch (error) {
      logger.error({ message: 'Failed to fetch contact pre-plan', context: { error, contactId } });
      const message = error instanceof Error ? error.message : 'Failed to fetch contact pre-plan';
      set((state) => ({
        loadingPreplan: { ...state.loadingPreplan, [contactId]: false },
        preplanErrors: { ...state.preplanErrors, [contactId]: message },
        error: message,
      }));
    }
  },

  fetchFiles: async (contactId: string, force = false) => {
    if (!contactId) return;
    if (!force && Object.prototype.hasOwnProperty.call(get().files, contactId)) return;

    set((state) => ({ loadingFiles: { ...state.loadingFiles, [contactId]: true }, error: null }));
    try {
      const result = await getContactFiles(contactId, false);
      set((state) => ({
        files: { ...state.files, [contactId]: result?.Data ?? [] },
        loadingFiles: { ...state.loadingFiles, [contactId]: false },
        fileErrors: withoutKey(state.fileErrors, contactId),
      }));
    } catch (error) {
      logger.error({ message: 'Failed to fetch contact files', context: { error, contactId } });
      const message = error instanceof Error ? error.message : 'Failed to fetch contact files';
      set((state) => ({
        loadingFiles: { ...state.loadingFiles, [contactId]: false },
        fileErrors: { ...state.fileErrors, [contactId]: message },
        error: message,
      }));
    }
  },

  invalidate: (contactId: string) =>
    set((state) => ({
      preplans: withoutKey(state.preplans, contactId),
      files: withoutKey(state.files, contactId),
      preplanErrors: withoutKey(state.preplanErrors, contactId),
      fileErrors: withoutKey(state.fileErrors, contactId),
    })),

  reset: () => set({ preplans: {}, files: {}, loadingPreplan: {}, loadingFiles: {}, preplanErrors: {}, fileErrors: {}, error: null }),
}));
