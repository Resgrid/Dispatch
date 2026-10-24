import { create } from 'zustand';

import { getArchivedCalls, getCallYears } from '@/api/calls/calls';
import { logger } from '@/lib/logging';
import { type CallResultData } from '@/models/v4/calls/callResultData';

interface ArchivedCallsState {
  /** Years the department has calls in, newest first; the selected year is always among them. */
  years: string[];
  /** The year whose archived calls are loaded; null until the years have loaded. */
  selectedYear: string | null;
  /** Closed calls logged in the selected year, newest first. */
  archivedCalls: CallResultData[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;

  /**
   * Loads the years, then the archived calls of `preferredYear`, else the year already selected, else the newest
   * year with calls (the current year when there are none).
   */
  load: (preferredYear?: string) => Promise<void>;
  selectYear: (year: string) => Promise<void>;
  /** Makes `year` the selected year without fetching, for the list to load when it next comes into view. */
  showYear: (year: string) => void;
  fetchArchivedCalls: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  years: [] as string[],
  selectedYear: null as string | null,
  archivedCalls: [] as CallResultData[],
  isLoading: false,
  error: null as string | null,
  lastFetched: 0,
};

/** The year list with `year` in its place (newest first), for a year the server has not reported calls in yet. */
const withYear = (years: string[], year: string): string[] => (years.includes(year) ? years : [...years, year].sort((a, b) => Number(b) - Number(a)));

const errorMessageOf = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);

// Each fetch takes a number; only the newest one may write, so switching years quickly never shows an older year's calls.
let latestRequest = 0;

export const useArchivedCallsStore = create<ArchivedCallsState>((set, get) => ({
  ...initialState,

  load: async (preferredYear?: string) => {
    const request = ++latestRequest;
    set({ isLoading: true, error: null });

    let years: string[];
    try {
      const response = await getCallYears();
      // "NotFound" with an empty list: the department has no calls yet.
      years = (response?.Data ?? []).map(String);
    } catch (error) {
      logger.error({ message: 'Failed to fetch call years', context: { error } });
      if (request === latestRequest) set({ error: errorMessageOf(error, 'Failed to fetch call years'), isLoading: false });
      return;
    }

    if (request !== latestRequest) return;

    const current = get().selectedYear;
    const year = preferredYear || (current && years.includes(current) ? current : years[0]) || String(new Date().getFullYear());
    set({ years: withYear(years, year), selectedYear: year });

    await get().fetchArchivedCalls();
  },

  selectYear: async (year: string) => {
    if (year === get().selectedYear && get().lastFetched > 0) return;

    // The previous year's rows would read as this year's while the new ones load.
    set((state) => ({ selectedYear: year, years: withYear(state.years, year), archivedCalls: [] }));
    await get().fetchArchivedCalls();
  },

  showYear: (year: string) => {
    // Stale even when it is the year already showing: those rows are from before the call just added. Another
    // year's rows would read as this year's until the load.
    set((state) => ({ selectedYear: year, years: withYear(state.years, year), archivedCalls: year === state.selectedYear ? state.archivedCalls : [], lastFetched: 0 }));
  },

  fetchArchivedCalls: async () => {
    const year = get().selectedYear;
    if (!year) return;

    const request = ++latestRequest;
    set({ isLoading: true, error: null });

    try {
      const response = await getArchivedCalls(year);
      if (request !== latestRequest) return;

      set({ archivedCalls: response?.Data ?? [], isLoading: false, lastFetched: Date.now() });
    } catch (error) {
      logger.error({ message: 'Failed to fetch archived calls', context: { error, year } });
      if (request !== latestRequest) return;

      set({ error: errorMessageOf(error, 'Failed to fetch archived calls'), isLoading: false });
    }
  },

  reset: () => {
    latestRequest++;
    set(initialState);
  },
}));
