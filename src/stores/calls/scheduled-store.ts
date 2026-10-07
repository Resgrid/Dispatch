import { create } from 'zustand';

import { getPendingScheduledCalls } from '@/api/calls/calls';
import { logger } from '@/lib/logging';
import { singleFlight } from '@/lib/single-flight';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { useCallsStore } from './store';

interface ScheduledCallsState {
  scheduledCalls: CallResultData[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;

  fetchScheduledCalls: () => Promise<void>;
  getPriorityForCall: (priorityId: number) => CallPriorityResultData | undefined;
  reset: () => void;
}

const initialState = {
  scheduledCalls: [],
  isLoading: false,
  error: null,
  lastFetched: 0,
};

export const useScheduledCallsStore = create<ScheduledCallsState>((set) => ({
  ...initialState,

  // Single-flight: the console and the scheduled list both refresh this on every calls push from SignalR.
  fetchScheduledCalls: singleFlight(async () => {
    set({ isLoading: true, error: null });

    try {
      logger.info({ message: 'Fetching pending scheduled calls from API' });

      const response = await getPendingScheduledCalls();
      const callsData = response?.Data ?? [];

      logger.info({
        message: 'Pending scheduled calls fetched successfully',
        context: { count: callsData.length },
      });

      set({
        scheduledCalls: callsData,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch scheduled calls';
      logger.error({
        message: 'Failed to fetch pending scheduled calls',
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
