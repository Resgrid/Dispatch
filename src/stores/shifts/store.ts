import { create } from 'zustand';

import { getAllShifts, getShift, getShiftDay, getTodaysShifts, signupForShiftDay } from '@/api/shifts/shifts';
import { logger } from '@/lib/logging';
import { type ShiftDaysResultData } from '@/models/v4/shifts/shiftDayResultData';
import { type ShiftResultData } from '@/models/v4/shifts/shiftResultData';

export type ShiftViewMode = 'today' | 'all';

interface ShiftsState {
  // Data
  shifts: ShiftResultData[];
  todaysShiftDays: ShiftDaysResultData[];
  selectedShift: ShiftResultData | null;
  selectedShiftDay: ShiftDaysResultData | null;
  selectedShiftDays: ShiftDaysResultData[];
  shiftCalendarData: Record<string, ShiftDaysResultData[]>; // shiftId -> shift days

  // UI State
  currentView: ShiftViewMode;
  searchQuery: string;
  isShiftDetailsOpen: boolean;
  isShiftDayDetailsOpen: boolean;
  selectedDate: string | null;

  // Loading states
  isLoading: boolean;
  isTodaysLoading: boolean;
  isShiftLoading: boolean;
  isShiftDayLoading: boolean;
  isSignupLoading: boolean;
  isCalendarLoading: boolean;

  // Error states
  error: string | null;
  signupError: string | null;

  // Actions - Data fetching
  init: () => Promise<void>;
  fetchAllShifts: () => Promise<void>;
  fetchTodaysShifts: () => Promise<void>;
  fetchShift: (shiftId: string) => Promise<void>;
  fetchShiftDay: (shiftDayId: string) => Promise<void>;
  //fetchShiftDaysForDateRange: (shiftId: string, startDate: string, endDate: string) => Promise<void>;

  // Actions - User interactions
  signupForShift: (shiftDayId: string, groupId: string) => Promise<void>;
  //withdrawFromShift: (shiftDayId: string, userId: string) => Promise<void>;

  // Actions - UI state
  setCurrentView: (view: ShiftViewMode) => void;
  setSearchQuery: (query: string) => void;
  selectShift: (shift: ShiftResultData) => void;
  selectShiftDay: (shiftDay: ShiftDaysResultData) => void;
  closeShiftDetails: () => void;
  closeShiftDayDetails: () => void;
  setSelectedDate: (date: string | null) => void;
  clearError: () => void;
  clearSignupError: () => void;

  // Computed properties helpers
  getShiftDaysForDate: (date: string) => ShiftDaysResultData[];
}

export const useShiftsStore = create<ShiftsState>((set, get) => ({
  // Initial data state
  shifts: [],
  todaysShiftDays: [],
  selectedShift: null,
  selectedShiftDay: null,
  selectedShiftDays: [],
  shiftCalendarData: {},

  // Initial UI state
  currentView: 'today',
  searchQuery: '',
  isShiftDetailsOpen: false,
  isShiftDayDetailsOpen: false,
  selectedDate: null,

  // Initial loading states
  isLoading: false,
  isTodaysLoading: false,
  isShiftLoading: false,
  isShiftDayLoading: false,
  isSignupLoading: false,
  isCalendarLoading: false,

  // Initial error states
  error: null,
  signupError: null,

  // Initialize store
  init: async () => {
    const state = get();
    if (state.isLoading) {
      logger.info({
        message: 'Shifts store initialization already in progress',
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        getAllShifts().then((response: { Data: ShiftResultData[] }) => {
          set((state) => ({ ...state, shifts: response.Data }));
        }),
        getTodaysShifts().then((response: { Data: ShiftDaysResultData[] }) => {
          set((state) => ({ ...state, todaysShiftDays: response.Data }));
        }),
      ]);
      logger.info({
        message: 'Shifts store initialization completed successfully',
      });
    } catch (error) {
      set({
        error: 'Failed to initialize shifts data',
        isLoading: false,
      });
      logger.error({
        message: 'Failed to initialize shifts store',
        context: { error },
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // Data fetching actions
  fetchAllShifts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getAllShifts();
      set({
        shifts: response.Data,
        isLoading: false,
      });
    } catch (error) {
      console.log('fetchAllShifts error:', error);
      set({
        error: 'Failed to fetch shifts',
        isLoading: false,
      });
      logger.error({
        message: 'Failed to fetch all shifts',
        context: { error },
      });
    }
  },

  fetchTodaysShifts: async () => {
    set({ isTodaysLoading: true, error: null });
    try {
      const response = await getTodaysShifts();
      set({
        todaysShiftDays: response.Data,
        isTodaysLoading: false,
      });
    } catch (error) {
      set({
        error: "Failed to fetch today's shifts",
        isTodaysLoading: false,
      });
      logger.error({
        message: "Failed to fetch today's shifts",
        context: { error },
      });
    }
  },

  fetchShift: async (shiftId: string) => {
    set({ isShiftLoading: true, error: null });
    try {
      const response = await getShift(shiftId);
      set({
        selectedShift: response.Data,
        isShiftLoading: false,
      });
    } catch (error) {
      set({
        error: 'Failed to fetch shift details',
        isShiftLoading: false,
      });
      logger.error({
        message: 'Failed to fetch shift',
        context: { error, shiftId },
      });
    }
  },

  fetchShiftDay: async (shiftDayId: string) => {
    set({ isShiftDayLoading: true, error: null });
    try {
      const response = await getShiftDay(shiftDayId);
      set({
        selectedShiftDay: response.Data,
        isShiftDayLoading: false,
      });
    } catch (error) {
      set({
        error: 'Failed to fetch shift day details',
        isShiftDayLoading: false,
      });
      logger.error({
        message: 'Failed to fetch shift day',
        context: { error, shiftDayId },
      });
    }
  },

  // User interaction actions
  signupForShift: async (shiftDayId: string, groupId: string) => {
    set({ isSignupLoading: true, signupError: null });
    try {
      await signupForShiftDay(shiftDayId, groupId);

      // Refresh data after successful signup
      await Promise.all([get().fetchTodaysShifts(), get().fetchShiftDay(shiftDayId)]);

      set({ isSignupLoading: false });
      logger.info({
        message: 'Successfully signed up for shift',
        context: { shiftDayId, groupId },
      });
    } catch (error) {
      set({
        signupError: 'Failed to sign up for shift',
        isSignupLoading: false,
      });
      logger.error({
        message: 'Failed to sign up for shift',
        context: { error, shiftDayId, groupId },
      });
    }
  },

  // UI state actions
  setCurrentView: (view) => set({ currentView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectShift: (shift) =>
    set({
      selectedShift: shift,
      isShiftDetailsOpen: true,
    }),
  selectShiftDay: (shiftDay) =>
    set({
      selectedShiftDay: shiftDay,
      isShiftDayDetailsOpen: true,
    }),
  closeShiftDetails: () =>
    set({
      isShiftDetailsOpen: false,
      selectedShift: null,
    }),
  closeShiftDayDetails: () =>
    set({
      isShiftDayDetailsOpen: false,
      selectedShiftDay: null,
    }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  clearError: () => set({ error: null }),
  clearSignupError: () => set({ signupError: null }),

  // Computed property helpers
  getShiftDaysForDate: (date: string) => {
    const { selectedShift, shiftCalendarData } = get();
    if (!selectedShift) return [];

    const shiftDays = shiftCalendarData[selectedShift.ShiftId] || [];
    return shiftDays.filter((shiftDay) => shiftDay.ShiftDay.startsWith(date));
  },
}));
