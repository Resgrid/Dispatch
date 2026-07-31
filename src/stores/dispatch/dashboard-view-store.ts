import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

/**
 * Dispatch-dashboard resource-view preferences.
 *
 * These flags let a dispatcher tune the Units/Personnel panels for situational awareness:
 * - `availableOnly` shows only resources whose current status is Available.
 * - `singleList` merges units and personnel into one combined list (see ResourcesPanel) instead of
 *   the separate Units and Personnel panels.
 *
 * The resource panels read these directly so no prop-drilling is needed across the responsive layouts.
 *
 * `collapsedCards` tracks each dashboard card's collapsed state. Together with the view flags above
 * it is persisted to device/browser storage so the console looks the same when the user signs back in.
 */
export type DashboardCardKey = 'active-calls' | 'units' | 'personnel' | 'notes' | 'resources' | 'map' | 'activity-log';

interface DashboardViewState {
  availableOnly: boolean;
  singleList: boolean;
  collapsedCards: Partial<Record<DashboardCardKey, boolean>>;
  toggleAvailableOnly: () => void;
  toggleSingleList: () => void;
  setAvailableOnly: (value: boolean) => void;
  setSingleList: (value: boolean) => void;
  setCardCollapsed: (card: DashboardCardKey, collapsed: boolean) => void;
}

export const useDashboardViewStore = create<DashboardViewState>()(
  persist(
    (set) => ({
      availableOnly: false,
      singleList: false,
      collapsedCards: {},
      toggleAvailableOnly: () => set((state) => ({ availableOnly: !state.availableOnly })),
      toggleSingleList: () => set((state) => ({ singleList: !state.singleList })),
      setAvailableOnly: (value) => set({ availableOnly: value }),
      setSingleList: (value) => set({ singleList: value }),
      setCardCollapsed: (card, collapsed) => set((state) => ({ collapsedCards: { ...state.collapsedCards, [card]: collapsed } })),
    }),
    {
      name: 'dashboard-view-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        availableOnly: state.availableOnly,
        singleList: state.singleList,
        collapsedCards: state.collapsedCards,
      }),
    }
  )
);

/** Selector helper: collapsed flag for a single card (defaults to expanded). */
export const selectCardCollapsed = (card: DashboardCardKey) => (state: DashboardViewState) => state.collapsedCards[card] ?? false;
