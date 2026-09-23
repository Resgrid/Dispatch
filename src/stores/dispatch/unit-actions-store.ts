import { create } from 'zustand';

import { saveUnitStatus } from '@/api/units/unitStatuses';
import { type DestinationSelectionType, getStatusDestinationPayload } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { SaveUnitStatusInput } from '@/models/v4/unitStatus/saveUnitStatusInput';

export type DestinationType = DestinationSelectionType;

export interface OpenUnitActionsOptions {
  /**
   * Explicit call context (the dashboard "+" set-status-for-call action). The destination is preset
   * to this call and it is sent with the status even when the status's Detail does not list calls.
   */
  callContext?: CallResultData | null;
}

interface UnitActionsState {
  // Panel visibility
  isActionsOpen: boolean;

  // Selected unit
  selectedUnit: UnitInfoResultData | null;

  // Explicit call context the panel was opened from (null for a plain unit selection)
  callContext: CallResultData | null;

  // Incremented on every openActions so the panel re-initialises its default destination per open
  actionsSessionId: number;
  // The session whose default destination has been applied (kept here so a remount does not re-apply it)
  destinationInitializedSessionId: number | null;

  // Status action state
  selectedStatus: StatusesResultData | null;
  statusDestinationType: DestinationType;
  statusSelectedCall: CallResultData | null;
  statusSelectedStation: GroupResultData | null;
  statusSelectedPoi: PoiResultData | null;
  statusNote: string;
  isSubmittingStatus: boolean;

  // Available options
  availableStatuses: StatusesResultData[];
  availableCalls: CallResultData[];
  availableStations: GroupResultData[];
  availablePois: PoiResultData[];
  isLoadingOptions: boolean;

  // Error handling
  statusError: string | null;

  // Actions
  openActions: (unit: UnitInfoResultData, options?: OpenUnitActionsOptions) => void;
  closeActions: () => void;
  markDestinationInitialized: (sessionId: number) => void;

  // Status actions
  setSelectedStatus: (status: StatusesResultData | null) => void;
  setStatusDestinationType: (type: DestinationType) => void;
  setStatusSelectedCall: (call: CallResultData | null) => void;
  setStatusSelectedStation: (station: GroupResultData | null) => void;
  setStatusSelectedPoi: (poi: PoiResultData | null) => void;
  setStatusNote: (note: string) => void;
  submitStatus: (overrides?: { unit?: UnitInfoResultData; status?: StatusesResultData }) => Promise<boolean>;
  resetStatusForm: () => void;

  // Data loading
  setAvailableStatuses: (statuses: StatusesResultData[]) => void;
  setAvailableCalls: (calls: CallResultData[]) => void;
  setAvailableStations: (stations: GroupResultData[]) => void;
  setAvailablePois: (pois: PoiResultData[]) => void;
  setIsLoadingOptions: (loading: boolean) => void;

  // Reset everything
  reset: () => void;
}

const initialState = {
  isActionsOpen: false,
  selectedUnit: null,
  callContext: null,
  actionsSessionId: 0,
  destinationInitializedSessionId: null,
  selectedStatus: null,
  statusDestinationType: 'none' as DestinationType,
  statusSelectedCall: null,
  statusSelectedStation: null,
  statusSelectedPoi: null,
  statusNote: '',
  isSubmittingStatus: false,
  availableStatuses: [],
  availableCalls: [],
  availableStations: [],
  availablePois: [],
  isLoadingOptions: false,
  statusError: null,
};

export const useUnitActionsStore = create<UnitActionsState>((set, get) => ({
  ...initialState,

  openActions: (unit, options) => {
    const callContext = options?.callContext ?? null;
    set((state) => ({
      isActionsOpen: true,
      selectedUnit: unit,
      callContext,
      actionsSessionId: state.actionsSessionId + 1,
      // Reset form states when opening for new unit; an explicit call context presets the destination
      selectedStatus: null,
      statusDestinationType: callContext ? 'call' : 'none',
      statusSelectedCall: callContext,
      statusSelectedStation: null,
      statusSelectedPoi: null,
      statusNote: '',
      statusError: null,
    }));
  },

  closeActions: () => {
    set({
      isActionsOpen: false,
      selectedUnit: null,
      callContext: null,
    });
  },

  markDestinationInitialized: (sessionId) => set({ destinationInitializedSessionId: sessionId }),

  // Status actions
  setSelectedStatus: (status) => set({ selectedStatus: status, statusError: null }),

  setStatusDestinationType: (type) => {
    const updates: Partial<UnitActionsState> = { statusDestinationType: type };
    // Clear previous selections when changing type
    if (type === 'none') {
      updates.statusSelectedCall = null;
      updates.statusSelectedStation = null;
      updates.statusSelectedPoi = null;
    } else if (type === 'call') {
      updates.statusSelectedStation = null;
      updates.statusSelectedPoi = null;
    } else if (type === 'station') {
      updates.statusSelectedCall = null;
      updates.statusSelectedPoi = null;
    } else if (type === 'poi') {
      updates.statusSelectedCall = null;
      updates.statusSelectedStation = null;
    }
    set(updates);
  },

  setStatusSelectedCall: (call) =>
    set({
      statusSelectedCall: call,
      statusDestinationType: 'call',
      statusSelectedStation: null,
      statusSelectedPoi: null,
    }),

  setStatusSelectedStation: (station) =>
    set({
      statusSelectedStation: station,
      statusDestinationType: 'station',
      statusSelectedCall: null,
      statusSelectedPoi: null,
    }),

  setStatusSelectedPoi: (poi) =>
    set({
      statusSelectedPoi: poi,
      statusDestinationType: 'poi',
      statusSelectedCall: null,
      statusSelectedStation: null,
    }),

  setStatusNote: (note) => set({ statusNote: note }),

  submitStatus: async (overrides?: { unit?: UnitInfoResultData; status?: StatusesResultData }) => {
    const storeState = get();
    const selectedUnit = overrides?.unit ?? storeState.selectedUnit;
    const selectedStatus = overrides?.status ?? storeState.selectedStatus;
    const { statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, statusNote, callContext } = storeState;

    if (!selectedUnit || !selectedStatus) {
      set({ statusError: 'Please select a status' });
      return false;
    }

    set({ isSubmittingStatus: true, statusError: null });

    try {
      const date = new Date();
      // Only send a destination the chosen status supports (an explicit call context always may carry its call)
      const { respondingTo, respondingToType } = getStatusDestinationPayload(
        {
          selectedDestinationType: statusDestinationType,
          selectedCall: statusSelectedCall,
          selectedStation: statusSelectedStation,
          selectedPoi: statusSelectedPoi,
        },
        selectedStatus.Detail,
        !!callContext
      );

      const input = new SaveUnitStatusInput();
      input.Id = selectedUnit.UnitId;
      input.Type = selectedStatus.Id.toString();
      input.RespondingTo = respondingTo;
      input.RespondingToType = respondingToType;
      input.TimestampUtc = date.toUTCString().replace('UTC', 'GMT');
      input.Timestamp = date.toISOString();
      input.Note = statusNote;
      // GPS coordinates could be added here if available
      input.Latitude = '';
      input.Longitude = '';
      input.Accuracy = '';
      input.Altitude = '';
      input.AltitudeAccuracy = '';
      input.Speed = '';
      input.Heading = '';
      input.EventId = '';
      input.Roles = [];

      await saveUnitStatus(input);

      // Reset the status and note after a successful submission. The destination stays sticky so a
      // follow-up status for the same unit (e.g. Responding -> On Scene) keeps the same call.
      set({
        isSubmittingStatus: false,
        selectedStatus: null,
        statusNote: '',
      });

      return true;
    } catch (error) {
      set({
        isSubmittingStatus: false,
        statusError: error instanceof Error ? error.message : 'Failed to update status',
      });
      return false;
    }
  },

  resetStatusForm: () =>
    set({
      selectedStatus: null,
      statusDestinationType: 'none',
      statusSelectedCall: null,
      statusSelectedStation: null,
      statusSelectedPoi: null,
      statusNote: '',
      statusError: null,
    }),

  // Data loading
  setAvailableStatuses: (statuses) => set({ availableStatuses: statuses }),
  setAvailableCalls: (calls) => set({ availableCalls: calls }),
  setAvailableStations: (stations) => set({ availableStations: stations }),
  setAvailablePois: (pois) => set({ availablePois: pois }),
  setIsLoadingOptions: (loading) => set({ isLoadingOptions: loading }),

  // Reset everything
  reset: () => set(initialState),
}));
