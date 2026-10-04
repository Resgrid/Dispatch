import { create } from 'zustand';

import { getCallLocationHistory } from '@/api/calls/callLocationHistory';
import { getContactCallHistory } from '@/api/contacts/contactCallHistory';
import { logger } from '@/lib/logging';
import { type LocationHistoryData } from '@/models/v4/calls/locationHistoryResult';

/** Whose history: the calls related to a call (same location or same contact) or to a contact (linked or at its occupancies). */
export interface LocationHistorySource {
  kind: 'call' | 'contact';
  id: string;
}

export interface LocationHistoryEntry {
  history: LocationHistoryData | null;
  isLoading: boolean;
  error: string | null;
}

export interface FetchHistoryOptions {
  /** Drop what is shown while the new answer loads; set when the grant is gone, so revealed text is not left on screen. */
  discardPrevious?: boolean;
}

interface LocationHistoryState {
  entries: Record<string, LocationHistoryEntry>;

  fetchHistory: (source: LocationHistorySource, options?: FetchHistoryOptions) => Promise<void>;
  clear: (source: LocationHistorySource) => void;
}

export const locationHistoryKey = (source: LocationHistorySource) => `${source.kind}:${source.id}`;

const responseStatus = (error: unknown): number | undefined => (error as { response?: { status?: number } })?.response?.status;

const problemType = (error: unknown): string | undefined => (error as { response?: { data?: { type?: string } } })?.response?.data?.type;

// Only the newest request for a key may write. Panels re-fetch the same source when the protected-data grant changes, so
// an answer from before a grant change (revealed or REDACTED) must never land after the newer one.
const latestRequests: Record<string, number> = {};
let sequence = 0;

/**
 * Location history state (call detail History tab, contact sheet Calls tab), keyed by source so a call panel and a
 * contact panel on screen together never overwrite each other.
 */
export const useLocationHistoryStore = create<LocationHistoryState>((set) => ({
  entries: {},

  fetchHistory: async (source: LocationHistorySource, options?: FetchHistoryOptions) => {
    const key = locationHistoryKey(source);
    const request = ++sequence;
    latestRequests[key] = request;
    set((state) => ({
      entries: { ...state.entries, [key]: { history: options?.discardPrevious ? null : (state.entries[key]?.history ?? null), isLoading: true, error: null } },
    }));

    try {
      const result = source.kind === 'call' ? await getCallLocationHistory(source.id) : await getContactCallHistory(source.id);
      if (latestRequests[key] !== request) {
        return;
      }
      set((state) => ({ entries: { ...state.entries, [key]: { history: result.Data ?? null, isLoading: false, error: null } } }));
    } catch (error) {
      if (latestRequests[key] !== request) {
        return;
      }
      // Only the status is logged. The raw Axios error carries the request config, including the grant header when
      // one is held; the logger forwards context to Sentry unsanitized.
      logger.error({
        message: 'Failed to fetch location history',
        context: { status: responseStatus(error), errorType: problemType(error), kind: source.kind, id: source.id },
      });
      set((state) => ({
        entries: {
          ...state.entries,
          [key]: { history: null, isLoading: false, error: error instanceof Error ? error.message : 'Failed to fetch location history' },
        },
      }));
    }
  },

  clear: (source: LocationHistorySource) => {
    const key = locationHistoryKey(source);
    latestRequests[key] = ++sequence;
    set((state) => {
      const entries = { ...state.entries };
      delete entries[key];
      return { entries };
    });
  },
}));
