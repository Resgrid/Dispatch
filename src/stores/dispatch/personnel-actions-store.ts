import { create } from 'zustand';

import { savePersonsStaffings } from '@/api/personnel/personnelStaffing';
import { savePersonsStatuses } from '@/api/personnel/personnelStatuses';
import { type DestinationSelectionType, getStatusDestinationPayload } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';

export type PersonnelActionTab = 'status' | 'staffing';
export type DestinationType = DestinationSelectionType;

export interface OpenPersonnelActionsOptions {
  /**
   * Explicit call context (the dashboard "+" set-status-for-call action). The destination is preset
   * to this call and it is sent with the status even when the status's Detail does not list calls.
   */
  callContext?: CallResultData | null;
}

interface PersonnelActionsState {
  // Panel visibility
  isActionsOpen: boolean;

  // Selected personnel
  selectedPersonnel: PersonnelInfoResultData | null;

  // Explicit call context the panel was opened from (null for a plain personnel selection)
  callContext: CallResultData | null;

  // Incremented on every openActions so the panel re-initialises its default destination per open
  actionsSessionId: number;
  // The session whose default destination has been applied (kept here so a remount does not re-apply it)
  destinationInitializedSessionId: number | null;

  // Current tab
  activeTab: PersonnelActionTab;

  // Status action state
  selectedStatus: StatusesResultData | null;
  statusDestinationType: DestinationType;
  statusSelectedCall: CallResultData | null;
  statusSelectedStation: GroupResultData | null;
  statusSelectedPoi: PoiResultData | null;
  statusNote: string;
  isSubmittingStatus: boolean;

  // Staffing action state
  selectedStaffing: StatusesResultData | null;
  staffingNote: string;
  isSubmittingStaffing: boolean;

  // Available options
  availableStatuses: StatusesResultData[];
  availableStaffings: StatusesResultData[];
  availableCalls: CallResultData[];
  availableStations: GroupResultData[];
  availablePois: PoiResultData[];
  isLoadingOptions: boolean;

  // Error handling
  statusError: string | null;
  staffingError: string | null;

  // Actions
  openActions: (personnel: PersonnelInfoResultData, options?: OpenPersonnelActionsOptions) => void;
  closeActions: () => void;
  markDestinationInitialized: (sessionId: number) => void;
  setActiveTab: (tab: PersonnelActionTab) => void;

  // Status actions
  setSelectedStatus: (status: StatusesResultData | null) => void;
  setStatusDestinationType: (type: DestinationType) => void;
  setStatusSelectedCall: (call: CallResultData | null) => void;
  setStatusSelectedStation: (station: GroupResultData | null) => void;
  setStatusSelectedPoi: (poi: PoiResultData | null) => void;
  setStatusNote: (note: string) => void;
  submitStatus: (overrides?: { personnel?: PersonnelInfoResultData; status?: StatusesResultData }) => Promise<boolean>;
  resetStatusForm: () => void;

  // Staffing actions
  setSelectedStaffing: (staffing: StatusesResultData | null) => void;
  setStaffingNote: (note: string) => void;
  submitStaffing: (overrides?: { personnel?: PersonnelInfoResultData; staffing?: StatusesResultData }) => Promise<boolean>;
  resetStaffingForm: () => void;

  // Data loading
  setAvailableStatuses: (statuses: StatusesResultData[]) => void;
  setAvailableStaffings: (staffings: StatusesResultData[]) => void;
  setAvailableCalls: (calls: CallResultData[]) => void;
  setAvailableStations: (stations: GroupResultData[]) => void;
  setAvailablePois: (pois: PoiResultData[]) => void;
  setIsLoadingOptions: (loading: boolean) => void;

  // Reset everything
  reset: () => void;
}

const initialState = {
  isActionsOpen: false,
  selectedPersonnel: null,
  callContext: null,
  actionsSessionId: 0,
  destinationInitializedSessionId: null,
  activeTab: 'status' as PersonnelActionTab,
  selectedStatus: null,
  statusDestinationType: 'none' as DestinationType,
  statusSelectedCall: null,
  statusSelectedStation: null,
  statusSelectedPoi: null,
  statusNote: '',
  isSubmittingStatus: false,
  selectedStaffing: null,
  staffingNote: '',
  isSubmittingStaffing: false,
  availableStatuses: [],
  availableStaffings: [],
  availableCalls: [],
  availableStations: [],
  availablePois: [],
  isLoadingOptions: false,
  statusError: null,
  staffingError: null,
};

export const usePersonnelActionsStore = create<PersonnelActionsState>((set, get) => ({
  ...initialState,

  openActions: (personnel, options) => {
    const callContext = options?.callContext ?? null;
    set((state) => ({
      isActionsOpen: true,
      selectedPersonnel: personnel,
      callContext,
      actionsSessionId: state.actionsSessionId + 1,
      activeTab: 'status',
      // Reset form states when opening for new personnel; an explicit call context presets the destination
      selectedStatus: null,
      statusDestinationType: callContext ? 'call' : 'none',
      statusSelectedCall: callContext,
      statusSelectedStation: null,
      statusSelectedPoi: null,
      statusNote: '',
      selectedStaffing: null,
      staffingNote: '',
      statusError: null,
      staffingError: null,
    }));
  },

  closeActions: () => {
    set({
      isActionsOpen: false,
      selectedPersonnel: null,
      callContext: null,
    });
  },

  markDestinationInitialized: (sessionId) => set({ destinationInitializedSessionId: sessionId }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Status actions
  setSelectedStatus: (status) => set({ selectedStatus: status, statusError: null }),

  setStatusDestinationType: (type) => {
    const updates: Partial<PersonnelActionsState> = { statusDestinationType: type };
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

  submitStatus: async (overrides?: { personnel?: PersonnelInfoResultData; status?: StatusesResultData }) => {
    const storeState = get();
    const selectedPersonnel = overrides?.personnel ?? storeState.selectedPersonnel;
    const selectedStatus = overrides?.status ?? storeState.selectedStatus;
    const { statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, statusNote, callContext } = storeState;

    if (!selectedPersonnel || !selectedStatus) {
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

      await savePersonsStatuses({
        UserIds: [selectedPersonnel.UserId],
        Type: selectedStatus.Id.toString(),
        RespondingTo: respondingTo,
        RespondingToType: respondingToType,
        TimestampUtc: date.toUTCString().replace('UTC', 'GMT'),
        Timestamp: date.toISOString(),
        Note: statusNote,
        Latitude: '',
        Longitude: '',
        Accuracy: '',
        Altitude: '',
        AltitudeAccuracy: '',
        Speed: '',
        Heading: '',
        EventId: '',
      });

      // Reset the status and note after a successful submission. The destination stays sticky so a
      // follow-up status for the same person (e.g. Responding -> On Scene) keeps the same call.
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

  // Staffing actions
  setSelectedStaffing: (staffing) => set({ selectedStaffing: staffing, staffingError: null }),

  setStaffingNote: (note) => set({ staffingNote: note }),

  submitStaffing: async (overrides?: { personnel?: PersonnelInfoResultData; staffing?: StatusesResultData }) => {
    const storeState = get();
    const selectedPersonnel = overrides?.personnel ?? storeState.selectedPersonnel;
    const selectedStaffing = overrides?.staffing ?? storeState.selectedStaffing;
    const { staffingNote } = storeState;

    if (!selectedPersonnel || !selectedStaffing) {
      set({ staffingError: 'Please select a staffing level' });
      return false;
    }

    set({ isSubmittingStaffing: true, staffingError: null });

    try {
      const date = new Date();

      await savePersonsStaffings({
        UserIds: [selectedPersonnel.UserId],
        Type: selectedStaffing.Id.toString(),
        TimestampUtc: date.toUTCString().replace('UTC', 'GMT'),
        Timestamp: date.toISOString(),
        Note: staffingNote,
        EventId: '',
      });

      // Reset the staffing form after successful submission
      set({
        isSubmittingStaffing: false,
        selectedStaffing: null,
        staffingNote: '',
      });

      return true;
    } catch (error) {
      set({
        isSubmittingStaffing: false,
        staffingError: error instanceof Error ? error.message : 'Failed to update staffing',
      });
      return false;
    }
  },

  resetStaffingForm: () =>
    set({
      selectedStaffing: null,
      staffingNote: '',
      staffingError: null,
    }),

  // Data loading
  setAvailableStatuses: (statuses) => set({ availableStatuses: statuses }),
  setAvailableStaffings: (staffings) => set({ availableStaffings: staffings }),
  setAvailableCalls: (calls) => set({ availableCalls: calls }),
  setAvailableStations: (stations) => set({ availableStations: stations }),
  setAvailablePois: (pois) => set({ availablePois: pois }),
  setIsLoadingOptions: (loading) => set({ isLoadingOptions: loading }),

  // Reset everything
  reset: () => set(initialState),
}));
