import { create } from 'zustand';

import { getPendingCalls } from '@/api/calls/calls';
import { logger } from '@/lib/logging';
import { singleFlight } from '@/lib/single-flight';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { useScheduledCallsStore } from './scheduled-store';
import { useCallsStore } from './store';

interface PendingCallsState {
  /** Calls saved as Pending (State 8), oldest first: numbered, nobody notified, waiting for a dispatcher. */
  pendingCalls: CallResultData[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;

  fetchPendingCalls: () => Promise<void>;
  getPriorityForCall: (priorityId: number) => CallPriorityResultData | undefined;
  reset: () => void;
}

const initialState = {
  pendingCalls: [],
  isLoading: false,
  error: null,
  lastFetched: 0,
};

export const usePendingCallsStore = create<PendingCallsState>((set) => ({
  ...initialState,

  // Single-flight: the console, the pending list, the sidebar and every calls push from SignalR all
  // refresh this together. Callers that arrive mid-request share one trailing refetch.
  fetchPendingCalls: singleFlight(async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await getPendingCalls();
      // "NotFound" with an empty list is the server's way of saying there are none.
      const callsData = response?.Data ?? [];

      set({
        pendingCalls: callsData,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending calls';
      logger.error({
        message: 'Failed to fetch pending calls',
        context: { error },
      });
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  }),

  getPriorityForCall: (priorityId: number) => {
    return useCallsStore.getState().callPriorities.find((p) => p.Id === priorityId);
  },

  reset: () => set(initialState),
}));

/**
 * Brings the not-yet-dispatched call lists up to date after a calls push (callAdded / callsUpdated /
 * callClosed) or a dispatch from this app: always the pending list, which the console's Pending tile and
 * the menu badge show, and the scheduled list only once something has loaded it -- nothing reads it
 * before the Scheduled Calls screen does, and that screen fetches on focus.
 */
export const refreshQueuedCallLists = () => {
  void usePendingCallsStore.getState().fetchPendingCalls();

  const scheduled = useScheduledCallsStore.getState();
  if (scheduled.lastFetched > 0) {
    void scheduled.fetchScheduledCalls();
  }
};
