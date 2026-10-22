import { create } from 'zustand';

import { saveUnitStatus } from '@/api/units/unitStatuses';
import { type DestinationSelectionType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';

import { buildSaveUnitStatusInput } from './unit-actions-store';

/** One unit's part of a multi-unit status change: the unit and its own status (status ids differ per status set). */
export interface BulkUnitStatusTarget {
  unitId: string;
  status: StatusesResultData;
}

interface UnitBulkActionsState {
  // Multi-select mode on the units lists: a tap adds/removes the unit instead of opening its own actions
  isSelectionMode: boolean;
  selectedUnitIds: string[];

  // Status form, applied to every selected unit. The status is held by its key (see resolveCommonUnitStatusOptions)
  // because each unit has its own status id for it.
  selectedStatusKey: string | null;
  statusDestinationType: DestinationSelectionType;
  statusSelectedCall: CallResultData | null;
  statusSelectedStation: GroupResultData | null;
  statusSelectedPoi: PoiResultData | null;
  // The dispatcher picked the destination (or "No destination"); the default call no longer replaces it
  isDestinationChosen: boolean;
  statusNote: string;
  isSubmitting: boolean;
  statusError: string | null;
  // Units whose status change failed on the last submit; the next submit retries only these
  failedUnitIds: string[];

  startSelection: (unitIds?: string[]) => void;
  endSelection: () => void;
  toggleUnit: (unitId: string) => void;
  addUnits: (unitIds: string[]) => void;
  clearSelection: () => void;

  setSelectedStatusKey: (key: string | null) => void;
  applyDefaultDestinationCall: (call: CallResultData | null) => void;
  chooseDestination: (type: DestinationSelectionType, item?: CallResultData | GroupResultData | PoiResultData) => void;
  setStatusNote: (note: string) => void;
  submitStatus: (targets: BulkUnitStatusTarget[]) => Promise<boolean>;

  reset: () => void;
}

const initialFormState = {
  selectedStatusKey: null,
  statusDestinationType: 'none' as DestinationSelectionType,
  statusSelectedCall: null,
  statusSelectedStation: null,
  statusSelectedPoi: null,
  isDestinationChosen: false,
  statusNote: '',
  isSubmitting: false,
  statusError: null,
  failedUnitIds: [],
};

const initialState = {
  isSelectionMode: false,
  selectedUnitIds: [],
  ...initialFormState,
};

const getDestinationState = (type: DestinationSelectionType, item?: CallResultData | GroupResultData | PoiResultData) => ({
  statusDestinationType: item || type === 'none' ? type : ('none' as DestinationSelectionType),
  statusSelectedCall: type === 'call' ? ((item as CallResultData | undefined) ?? null) : null,
  statusSelectedStation: type === 'station' ? ((item as GroupResultData | undefined) ?? null) : null,
  statusSelectedPoi: type === 'poi' ? ((item as PoiResultData | undefined) ?? null) : null,
});

export const useUnitBulkActionsStore = create<UnitBulkActionsState>((set, get) => ({
  ...initialState,

  startSelection: (unitIds = []) => set({ ...initialFormState, isSelectionMode: true, selectedUnitIds: Array.from(new Set(unitIds)) }),

  endSelection: () => set(initialState),

  toggleUnit: (unitId) => {
    const { selectedUnitIds } = get();
    const next = selectedUnitIds.includes(unitId) ? selectedUnitIds.filter((id) => id !== unitId) : [...selectedUnitIds, unitId];
    // Emptying the selection ends that group: its status form goes with it. Any change of the units means the next
    // submit is for all of them again, not a retry of the failed ones.
    set(next.length === 0 ? { ...initialFormState, isSelectionMode: true, selectedUnitIds: [] } : { isSelectionMode: true, selectedUnitIds: next, failedUnitIds: [] });
  },

  addUnits: (unitIds) => {
    const { selectedUnitIds } = get();
    const next = Array.from(new Set([...selectedUnitIds, ...unitIds]));
    if (next.length === selectedUnitIds.length) return;
    set({ isSelectionMode: true, selectedUnitIds: next, failedUnitIds: [] });
  },

  clearSelection: () => set({ ...initialFormState, selectedUnitIds: [] }),

  setSelectedStatusKey: (key) => set({ selectedStatusKey: key, statusError: null, failedUnitIds: [] }),

  applyDefaultDestinationCall: (call) => {
    if (get().isDestinationChosen) return;
    set(getDestinationState(call ? 'call' : 'none', call ?? undefined));
  },

  chooseDestination: (type, item) => set({ ...getDestinationState(type, item), isDestinationChosen: true }),

  setStatusNote: (note) => set({ statusNote: note }),

  submitStatus: async (targets) => {
    const { statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, statusNote, failedUnitIds } = get();

    // After a partial failure only the units that failed are sent again, so the others do not get the status twice
    const pending = failedUnitIds.length > 0 ? targets.filter((target) => failedUnitIds.includes(target.unitId)) : targets;
    if (pending.length === 0) {
      set({ statusError: 'Please select a status' });
      return false;
    }

    set({ isSubmitting: true, statusError: null });

    const destination = {
      selectedDestinationType: statusDestinationType,
      selectedCall: statusSelectedCall,
      selectedStation: statusSelectedStation,
      selectedPoi: statusSelectedPoi,
    };
    // One timestamp for the whole group: the units changed status together
    const date = new Date();
    const results = await Promise.allSettled(pending.map((target) => saveUnitStatus(buildSaveUnitStatusInput({ unitId: target.unitId, status: target.status, destination, note: statusNote, date }))));

    const failed = pending.filter((_, index) => results[index].status === 'rejected').map((target) => target.unitId);
    if (failed.length > 0) {
      const reason = (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason;
      set({
        isSubmitting: false,
        failedUnitIds: failed,
        statusError: reason instanceof Error ? reason.message : 'Failed to update status',
      });
      return false;
    }

    // The selection and destination stay, so the same units can move on to their next status together
    // (e.g. Transporting -> At Hospital -> Returning).
    set({ isSubmitting: false, selectedStatusKey: null, statusNote: '', failedUnitIds: [] });
    return true;
  },

  reset: () => set(initialState),
}));
