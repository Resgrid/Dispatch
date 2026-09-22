import { create } from 'zustand';

import { getCallSiteInfo } from '@/api/calls/callSiteInfo';
import { logger } from '@/lib/logging';
import { type CallSiteInfoData } from '@/models/v4/calls/callSiteInfoResult';

interface SiteInfoState {
  callId: string | null;
  siteInfo: CallSiteInfoData | null;
  isLoading: boolean;
  error: string | null;

  fetchSiteInfo: (callId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Site Info tab state (Contacts plan Phase A): the pre-plans, hazards, alert notes and files of the
 * contacts linked to the call being viewed. One call at a time; the tab re-fetches after a step-up so
 * REDACTED values are replaced by the revealed ones.
 */
export const useSiteInfoStore = create<SiteInfoState>((set, get) => ({
  callId: null,
  siteInfo: null,
  isLoading: false,
  error: null,

  fetchSiteInfo: async (callId: string) => {
    set({ isLoading: true, error: null, callId });
    try {
      const result = await getCallSiteInfo(callId);
      if (get().callId !== callId) {
        return; // stale response — a different call is being viewed now
      }
      set({ siteInfo: result.Data ?? null, isLoading: false });
    } catch (error) {
      if (get().callId !== callId) {
        return;
      }
      logger.error({
        message: 'Failed to fetch call site info',
        context: { error, callId },
      });
      set({
        siteInfo: null,
        error: error instanceof Error ? error.message : 'Failed to fetch call site info',
        isLoading: false,
      });
    }
  },

  reset: () => set({ callId: null, siteInfo: null, isLoading: false, error: null }),
}));
