import { create } from 'zustand';

import { getAllUnitStatuses } from '@/api/satuses';
import { getUnitsInfos } from '@/api/units/units';
import { singleFlight } from '@/lib/single-flight';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

interface UnitsState {
  units: UnitInfoResultData[];
  unitStatuses: UnitTypeStatusResultData[];
  isLoading: boolean;
  error: string | null;
  fetchUnits: () => Promise<void>;
}

export const useUnitsStore = create<UnitsState>((set) => ({
  units: [],
  unitStatuses: [],
  isLoading: false,
  error: null,
  // Single-flight: the console, its panels, the status sheet and every SignalR push all call this, often
  // together. Callers that arrive mid-request get one trailing refetch, so a status saved after the
  // request left still lands.
  fetchUnits: singleFlight(async () => {
    set({ isLoading: true, error: null });
    try {
      // Always from the server. This runs on mount, on focus and after every unitStatusUpdated push;
      // reading the cached copy here kept showing the status from before the change for as long as the
      // cache lived (it is persisted, so even across restarts).
      const unitsResponse = await getUnitsInfos('', true);
      const unitStatusesResponse = await getAllUnitStatuses();
      set({ units: unitsResponse.Data, unitStatuses: unitStatusesResponse.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch units', isLoading: false });
    }
  }),
}));
