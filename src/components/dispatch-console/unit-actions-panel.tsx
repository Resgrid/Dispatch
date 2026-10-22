import { Building2, ChevronDown, ChevronRight, ChevronUp, MapPinned, Phone, Send, Truck, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { UnitTypeIcon } from '@/components/units/unit-type-icon';
import {
  DestinationEntityType,
  type DestinationTab,
  getDefaultDestinationTab,
  getEffectiveDestinationType,
  getStatusDestinationCapabilities,
  isTransportStatus,
  resolveDefaultDestinationCall,
  resolveTransportDestinationPoi,
} from '@/lib/destination-helpers';
import { getPoiSelectionLabel } from '@/lib/poi-display';
import { resolveUnitStatusOptions } from '@/lib/unit-status-helpers';
import { isCallActive } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useCallsStore } from '@/stores/calls/store';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';
import { useUnitsStore } from '@/stores/units/store';

import { UnitDestinationSheet, UnitStatusSheet } from './unit-status-sheets';

interface UnitActionsPanelProps {
  unit?: UnitInfoResultData | null;
  onStatusUpdated?: () => void;
}

export const UnitActionsPanel: React.FC<UnitActionsPanelProps> = ({ unit: unitProp, onStatusUpdated }) => {
  const { t } = useTranslation();

  // Get calls directly from calls store using selector
  const calls = useCallsStore((state) => state.calls);
  const isLoadingCalls = useCallsStore((state) => state.isLoadingCalls);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);

  // Local state for action sheets
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isDestinationSheetOpen, setIsDestinationSheetOpen] = useState(false);
  // The destination sheet opens a beat after the status sheet closes.
  const destinationSheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(false);
  const [destinationTab, setDestinationTab] = useState<DestinationTab>('calls');

  // Local state for selected status (to fix synchronization issues)
  const [localSelectedStatus, setLocalSelectedStatus] = useState<StatusesResultData | null>(null);

  // The console's selected call — a default destination when the unit's own destination is not an active call
  const selectedCallId = useDispatchConsoleStore((state) => state.selectedCallId);

  // Whether the per-unit options (stations/POIs) have finished loading for the given unit
  const [optionsLoadedForUnitId, setOptionsLoadedForUnitId] = useState<string | null>(null);

  // The calls re-fetch for a working call the calls list did not have (keyed by open session and call), so it runs once
  const [workingCallLookup, setWorkingCallLookup] = useState<{ key: string; settled: boolean } | null>(null);

  // Store state
  const {
    selectedUnit: storeSelectedUnit,
    callContext,
    actionsSessionId,
    destinationInitializedSessionId,
    markDestinationInitialized,
    selectedStatus: storeSelectedStatus,
    statusDestinationType,
    statusSelectedCall,
    statusSelectedStation,
    statusSelectedPoi,
    statusNote,
    isSubmittingStatus,
    availableStatuses,
    availableStations,
    availablePois,
    isLoadingOptions,
    statusError,
    closeActions,
    setSelectedStatus: setStoreSelectedStatus,
    setStatusDestinationType,
    setStatusSelectedCall,
    setStatusSelectedStation,
    setStatusSelectedPoi,
    setStatusNote,
    submitStatus: storeSubmitStatus,
    setAvailableStatuses,
    setAvailableCalls,
    setAvailableStations,
    setAvailablePois,
    setIsLoadingOptions,
  } = useUnitActionsStore();

  // Use local state for selected status, synced with store
  const selectedStatus = localSelectedStatus;

  // Sync local state with store (for initial values and external changes)
  useEffect(() => {
    setLocalSelectedStatus(storeSelectedStatus);
  }, [storeSelectedStatus]);

  // Wrapper to update both local state and store
  const setSelectedStatus = useCallback(
    (status: StatusesResultData | null) => {
      setLocalSelectedStatus(status);
      setStoreSelectedStatus(status);
    },
    [setStoreSelectedStatus]
  );

  // Use prop if available, fallback to store
  const selectedUnit = unitProp ?? storeSelectedUnit;

  // A pending open belongs to the session it was chosen in: it dies with the panel, and with a switch to
  // another unit or a new session, so it never opens the sheet over what the dispatcher is now doing.
  useEffect(
    () => () => {
      if (destinationSheetTimerRef.current) {
        clearTimeout(destinationSheetTimerRef.current);
        destinationSheetTimerRef.current = null;
      }
    },
    [actionsSessionId, selectedUnit?.UnitId]
  );

  // Load options when panel opens
  useEffect(() => {
    if (!selectedUnit) return;

    let cancelled = false;

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const unitStatusData = await getSetUnitStatusData(selectedUnit.UnitId);
        // Ensure the grouped per-unit-type statuses are loaded so we can scope to the unit's custom set.
        let groups = useUnitsStore.getState().unitStatuses;
        if (!groups || groups.length === 0) {
          await useUnitsStore.getState().fetchUnits();
          groups = useUnitsStore.getState().unitStatuses;
        }
        // A newer unit was selected while this load was in flight — don't overwrite its options.
        if (cancelled) return;
        const serverStatuses = (unitStatusData?.Data?.Statuses as unknown as StatusesResultData[]) || [];
        setAvailableStatuses(resolveUnitStatusOptions(selectedUnit, groups, serverStatuses));
        setAvailableCalls(unitStatusData?.Data?.Calls || []);
        setAvailableStations(unitStatusData?.Data?.Stations || []);
        setAvailablePois(unitStatusData?.Data?.DestinationPois || []);
      } catch (error) {
        console.error('Failed to load unit action options:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
          setOptionsLoadedForUnitId(selectedUnit.UnitId);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [selectedUnit, setAvailableStatuses, setAvailableCalls, setAvailableStations, setAvailablePois, setIsLoadingOptions]);

  // Active calls for destination selection and default-destination resolution
  const activeCalls = useMemo(() => {
    return calls.filter((c) => isCallActive(c.State));
  }, [calls]);

  // Update available calls from calls store
  useEffect(() => {
    setAvailableCalls(activeCalls);
  }, [activeCalls, setAvailableCalls]);

  // Apply the default destination once per open of the actions panel (openActions starts a new session:
  // a unit selection, a re-selection or a "+" set-status-for-call). A successful submit does not start a
  // new session, so the destination stays sticky for follow-up statuses of the same unit. The applied
  // session lives in the store so remounting the panel (e.g. switching tabs) does not re-apply it.
  useEffect(() => {
    if (!selectedUnit) return;
    // Wait until the store has been opened for this unit (the parent opens it after selection changes).
    if (storeSelectedUnit?.UnitId !== selectedUnit.UnitId) return;
    if (destinationInitializedSessionId === actionsSessionId) return;

    // The dispatcher picked a destination before the default could be worked out: theirs stands.
    if (!callContext && statusDestinationType !== 'none') {
      markDestinationInitialized(actionsSessionId);
      return;
    }

    // The unit is on a call the calls list does not have (still loading, or loaded before the call was created): look it
    // up once for this open and wait, rather than settle on a fallback (another call, or no destination), which left
    // dispatchers picking the call by hand for every status (Belgian EMS, 2026-10-07).
    const workingCallId = selectedUnit.ActiveCallId;
    if (!callContext && workingCallId && !activeCalls.some((call) => call.CallId === workingCallId)) {
      if (isLoadingCalls) return;
      const lookupKey = `${actionsSessionId}:${workingCallId}`;
      if (workingCallLookup?.key !== lookupKey) {
        setWorkingCallLookup({ key: lookupKey, settled: false });
        void fetchCalls().finally(() => setWorkingCallLookup((current) => (current?.key === lookupKey ? { key: lookupKey, settled: true } : current)));
        return;
      }
      if (!workingCallLookup.settled) return;
    }

    // (a) explicit call context, (b) the call the server says the unit is working, (c) the unit's current destination if
    // it is an active call, (d) the console's selected call
    const defaultCall = resolveDefaultDestinationCall({
      callContext,
      workingCallId,
      currentDestinationId: selectedUnit.CurrentDestinationId,
      currentDestinationType: selectedUnit.CurrentDestinationType,
      selectedCallId,
      activeCalls,
    });
    if (defaultCall) {
      setStatusSelectedCall(defaultCall);
      markDestinationInitialized(actionsSessionId);
      return;
    }

    // Stations and POIs come from the per-unit options load; wait for it before settling on a default.
    if (optionsLoadedForUnitId !== selectedUnit.UnitId) return;

    const destinationType = selectedUnit.CurrentDestinationType;
    const destinationId = selectedUnit.CurrentDestinationId;
    const canBeStation = destinationType === null || destinationType === undefined || destinationType === DestinationEntityType.Station;
    const canBePoi = destinationType === null || destinationType === undefined || destinationType === DestinationEntityType.Poi;
    const matchingStation = destinationId && canBeStation ? availableStations.find((s) => s.GroupId === destinationId) : undefined;
    const matchingPoi = destinationId && canBePoi && !matchingStation ? availablePois.find((poi) => poi.PoiId.toString() === destinationId) : undefined;

    if (matchingStation) {
      setStatusSelectedStation(matchingStation);
    } else if (matchingPoi) {
      setStatusSelectedPoi(matchingPoi);
    }
    markDestinationInitialized(actionsSessionId);
  }, [
    selectedUnit,
    storeSelectedUnit,
    callContext,
    actionsSessionId,
    destinationInitializedSessionId,
    selectedCallId,
    activeCalls,
    isLoadingCalls,
    fetchCalls,
    workingCallLookup,
    statusDestinationType,
    optionsLoadedForUnitId,
    availableStations,
    availablePois,
    markDestinationInitialized,
    setStatusSelectedCall,
    setStatusSelectedStation,
    setStatusSelectedPoi,
  ]);

  const handleSubmitStatus = useCallback(async () => {
    // Pass current unit and status directly to avoid state sync issues
    const success = await storeSubmitStatus({
      unit: selectedUnit ?? undefined,
      status: localSelectedStatus ?? undefined,
    });
    if (success) {
      setLocalSelectedStatus(null);
      onStatusUpdated?.();
    }
  }, [storeSubmitStatus, selectedUnit, localSelectedStatus, onStatusUpdated]);

  // An explicit call context ("+" set-status-for-call) may carry its call with any status
  const hasCallContext = !!callContext;

  const destinationSelection = useMemo(
    () => ({
      selectedDestinationType: statusDestinationType,
      selectedCall: statusSelectedCall,
      selectedStation: statusSelectedStation,
      selectedPoi: statusSelectedPoi,
    }),
    [statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi]
  );

  // The destination that will actually be sent with the selected status (a destination the status
  // does not support is dropped), so the panel shows exactly what will be saved.
  const effectiveDestinationType = useMemo(() => getEffectiveDestinationType(destinationSelection, selectedStatus?.Detail, hasCallContext), [destinationSelection, selectedStatus, hasCallContext]);

  // The call the unit is working: its destination call, the explicit context, or the call the server says it is on. It
  // stays known once the destination moves on to the hospital, so its destination POI can be defaulted and compared.
  const unitCall = useMemo(() => {
    const callId = statusSelectedCall?.CallId ?? callContext?.CallId ?? selectedUnit?.ActiveCallId;
    if (!callId) return null;
    return activeCalls.find((call) => call.CallId === callId) ?? statusSelectedCall ?? callContext;
  }, [statusSelectedCall, callContext, selectedUnit, activeCalls]);
  const callDestinationPoiId = unitCall?.DestinationPoiId ?? null;

  // The POI the unit is already taking the patient to (its destination while Transporting or At Hospital)
  const transportPoiId = selectedUnit && isTransportStatus(selectedUnit.CurrentStatusBaseType) && selectedUnit.CurrentDestinationType === DestinationEntityType.Poi ? selectedUnit.CurrentDestinationId : null;

  // A destination POI other than the one the call was logged with (the crew changed hospital): flagged so the
  // dispatcher can check it with the crew and note why.
  const isOffCallDestination = effectiveDestinationType === 'poi' && !!statusSelectedPoi && callDestinationPoiId !== null && statusSelectedPoi.PoiId !== callDestinationPoiId;
  const callDestinationLabel = useMemo(() => {
    if (callDestinationPoiId === null) return '';
    const poi = availablePois.find((candidate) => candidate.PoiId === callDestinationPoiId);
    return poi ? getPoiSelectionLabel(poi) : (unitCall?.DestinationName?.trim() ?? '');
  }, [callDestinationPoiId, availablePois, unitCall]);

  // Get destination display text
  const getDestinationDisplay = useMemo(() => {
    if (effectiveDestinationType === 'call' && statusSelectedCall) {
      return `#${statusSelectedCall.Number} - ${statusSelectedCall.Name}`;
    }
    if (effectiveDestinationType === 'station' && statusSelectedStation) {
      return statusSelectedStation.Name;
    }
    if (effectiveDestinationType === 'poi' && statusSelectedPoi) {
      return getPoiSelectionLabel(statusSelectedPoi);
    }
    return t('dispatch.unit_actions_panel.no_destination');
  }, [effectiveDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, t]);

  // Check destination type allowed based on Detail
  const destinationConfig = useMemo(() => {
    return getStatusDestinationCapabilities(selectedStatus?.Detail, hasCallContext);
  }, [selectedStatus, hasCallContext]);

  // Check note requirement based on Note field
  // Note: 0 = No note, 1 = Optional, 2 = Required
  const statusNoteConfig = useMemo(() => {
    if (!selectedStatus) return { show: true, required: false };
    return {
      show: true,
      required: selectedStatus.Note === 2,
    };
  }, [selectedStatus]);

  // The default destination is still waiting on the unit's working call (calls loading, or the one-off lookup in flight).
  // A status that takes any destination is held until the default lands (the call, or the station/POI it falls back to)
  // or the dispatcher picks a destination, so it is not sent without it.
  const isAwaitingWorkingCall = useMemo(() => {
    const workingCallId = selectedUnit?.ActiveCallId;
    if (!workingCallId || callContext || storeSelectedUnit?.UnitId !== selectedUnit?.UnitId) return false;
    if (destinationInitializedSessionId === actionsSessionId) return false;
    return !activeCalls.some((call) => call.CallId === workingCallId);
  }, [selectedUnit, callContext, storeSelectedUnit, destinationInitializedSessionId, actionsSessionId, activeCalls]);
  const isHeldForWorkingCall = isAwaitingWorkingCall && destinationConfig.supportsDestination;

  // Validate status can be submitted
  const canSubmitStatus = useMemo(() => {
    if (!selectedStatus) return false;
    // Check if note is required and not provided
    if (selectedStatus.Note === 2 && !statusNote.trim()) return false;
    if (isHeldForWorkingCall) return false;
    return true;
  }, [selectedStatus, statusNote, isHeldForWorkingCall]);

  // The destination sheet opens on the current destination's tab (e.g. the hospital of a transport status), else the
  // status's first one
  useEffect(() => {
    if (!selectedStatus) return;
    if (effectiveDestinationType !== 'none') {
      setDestinationTab(effectiveDestinationType === 'call' ? 'calls' : effectiveDestinationType === 'station' ? 'stations' : 'pois');
      return;
    }
    setDestinationTab(hasCallContext ? 'calls' : getDefaultDestinationTab(selectedStatus.Detail));
  }, [selectedStatus, hasCallContext, effectiveDestinationType]);

  // Refresh calls when destination sheet opens
  useEffect(() => {
    if (isDestinationSheetOpen) {
      fetchCalls();
    }
  }, [isDestinationSheetOpen, fetchCalls]);

  // Handle status selection
  const handleStatusSelect = (status: StatusesResultData) => {
    setSelectedStatus(status);
    setIsStatusSheetOpen(false);
    // A transport status goes to the hospital the call was logged with (or the one the unit is already taking the
    // patient to), so the dispatcher checks it rather than picks it (Belgian EMS, 2026-10-21).
    const transportPoi = resolveTransportDestinationPoi({ status, selection: destinationSelection, hasCallContext, callDestinationPoiId, transportPoiId, availablePois });
    if (transportPoi) {
      setStatusSelectedPoi(transportPoi);
      // As with a dispatcher's pick, a working-call lookup landing later must not replace it
      markDestinationInitialized(actionsSessionId);
      return;
    }
    // If the status takes a destination and none applies yet, open the destination sheet. A preset or
    // sticky destination the status supports (e.g. the call) is kept and shown instead.
    const supportsDestination = getStatusDestinationCapabilities(status.Detail, hasCallContext).supportsDestination;
    if (supportsDestination && getEffectiveDestinationType(destinationSelection, status.Detail, hasCallContext) === 'none') {
      if (destinationSheetTimerRef.current) clearTimeout(destinationSheetTimerRef.current);
      destinationSheetTimerRef.current = setTimeout(() => {
        destinationSheetTimerRef.current = null;
        setIsDestinationSheetOpen(true);
      }, 300);
    }
  };

  // Handle destination selection
  const handleDestinationSelect = (type: 'none' | 'call' | 'station' | 'poi', item?: CallResultData | GroupResultData | PoiResultData) => {
    if (type === 'none') {
      // Clears the call, station and POI selections too
      setStatusDestinationType('none');
    } else if (type === 'call' && item) {
      setStatusSelectedCall(item as CallResultData);
    } else if (type === 'station' && item) {
      setStatusSelectedStation(item as GroupResultData);
    } else if (type === 'poi' && item) {
      setStatusSelectedPoi(item as PoiResultData);
    }
    // An explicit choice, "No destination" included, ends the default for this open: a working-call lookup still in
    // flight must not replace it when it lands.
    markDestinationInitialized(actionsSessionId);
    setIsDestinationSheetOpen(false);
  };

  // Don't render if no unit selected
  if (!selectedUnit) {
    return null;
  }

  return (
    <>
      <Box className="rounded-lg border border-blue-300 bg-white dark:border-blue-700 dark:bg-gray-900">
        {/* Header with selected unit */}
        <HStack className="items-center justify-between border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
          <HStack className="flex-1 items-center" space="xs">
            <View style={styles.avatar}>
              <UnitTypeIcon iconUrl={selectedUnit.TypeIconUrl} mapIcon={selectedUnit.TypeMapIcon} size={18} fallback={<Icon as={Truck} size="xs" className="text-blue-500" />} />
            </View>
            <VStack className="flex-1">
              <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
                {selectedUnit.Name}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                {selectedUnit.Type || selectedUnit.GroupName || t('dispatch.unassigned')}
              </Text>
            </VStack>
          </HStack>
          <Pressable onPress={closeActions} style={styles.closeButton}>
            <Icon as={X} size="xs" className="text-gray-500" />
          </Pressable>
        </HStack>

        {/* Loading State */}
        {isLoadingOptions ? (
          <VStack className="items-center justify-center p-4" space="xs">
            <Spinner size="small" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</Text>
          </VStack>
        ) : (
          <VStack className="p-2" space="xs">
            {/* Status Selection Button */}
            <Pressable onPress={() => setIsStatusSheetOpen(true)}>
              <HStack className="items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <HStack className="flex-1 items-center" space="sm">
                  <Icon as={Truck} size="sm" className="text-blue-500" />
                  <VStack className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.status')}</Text>
                    {selectedStatus ? (
                      <HStack className="items-center" space="xs">
                        <View style={StyleSheet.flatten([styles.miniIndicator, { backgroundColor: selectedStatus.BColor || '#6b7280' }])} />
                        <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{selectedStatus.Text}</Text>
                      </HStack>
                    ) : (
                      <Text className="text-sm text-gray-400 dark:text-gray-500">{t('dispatch.unit_actions_panel.select_status')}</Text>
                    )}
                  </VStack>
                </HStack>
                <Icon as={ChevronRight} size="sm" className="text-gray-400" />
              </HStack>
            </Pressable>

            {/* Destination Button (only show if status is selected and supports destination) */}
            {selectedStatus && destinationConfig.supportsDestination ? (
              <Pressable onPress={() => setIsDestinationSheetOpen(true)}>
                <HStack
                  className={`items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 dark:bg-gray-800 ${isOffCallDestination ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <HStack className="flex-1 items-center" space="sm">
                    <Icon as={effectiveDestinationType === 'call' ? Phone : effectiveDestinationType === 'poi' ? MapPinned : Building2} size="sm" className="text-amber-500" />
                    <VStack className="flex-1">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.destination')}</Text>
                      <Text className="text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
                        {getDestinationDisplay}
                      </Text>
                      {isOffCallDestination ? (
                        <Text className="text-xs font-medium text-amber-600 dark:text-amber-400" numberOfLines={2}>
                          {t('dispatch.unit_actions_panel.differs_from_call_destination', { name: callDestinationLabel })}
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                  <Icon as={ChevronRight} size="sm" className="text-gray-400" />
                </HStack>
              </Pressable>
            ) : null}

            {/* Status Note Input - Always visible */}
            <TextInput
              style={styles.noteInput}
              className={`rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100 ${
                statusNoteConfig.required && !statusNote.trim() ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
              }`}
              placeholder={`${isOffCallDestination ? t('dispatch.unit_actions_panel.destination_change_reason') : t('dispatch.unit_actions_panel.note')}${statusNoteConfig.required ? ' *' : ` (${t('common.optional')})`}`}
              placeholderTextColor="#9ca3af"
              value={statusNote}
              onChangeText={setStatusNote}
            />

            {/* Update Status Button */}
            {selectedStatus ? (
              <>
                {statusError ? <Text className="text-xs text-red-500">{statusError}</Text> : null}
                <Button size="sm" onPress={handleSubmitStatus} isDisabled={!canSubmitStatus || isSubmittingStatus} className="bg-blue-600">
                  {isSubmittingStatus || isHeldForWorkingCall ? <ButtonSpinner color="white" /> : <Icon as={Send} size="xs" color="white" />}
                  <ButtonText className="ml-1 text-xs">{t('dispatch.unit_actions_panel.update_status')}</ButtonText>
                </Button>
              </>
            ) : null}

            {/* Additional Fields divider */}
            <View className="my-1 h-px bg-gray-200 dark:bg-gray-700" />

            {/* Additional Fields (UDF) */}
            <Pressable onPress={() => setIsAdditionalFieldsExpanded((prev) => !prev)}>
              <HStack className="items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('calls.additional_fields', 'Additional Fields')}</Text>
                <Icon as={isAdditionalFieldsExpanded ? ChevronUp : ChevronDown} size="sm" className="text-gray-400" />
              </HStack>
            </Pressable>
            {isAdditionalFieldsExpanded ? <UdfFieldsRenderer entityType={2} entityId={selectedUnit.UnitId} onValuesChange={() => {}} readOnly={true} /> : null}
          </VStack>
        )}
      </Box>

      <UnitStatusSheet isOpen={isStatusSheetOpen} onClose={() => setIsStatusSheetOpen(false)} statuses={availableStatuses} selectedStatusId={selectedStatus?.Id} onSelect={handleStatusSelect} />

      <UnitDestinationSheet
        isOpen={isDestinationSheetOpen}
        onClose={() => setIsDestinationSheetOpen(false)}
        capabilities={destinationConfig}
        activeTab={destinationTab}
        onTabChange={setDestinationTab}
        calls={activeCalls}
        stations={availableStations}
        pois={availablePois}
        effectiveDestinationType={effectiveDestinationType}
        selectedCall={statusSelectedCall}
        selectedStation={statusSelectedStation}
        selectedPoi={statusSelectedPoi}
        onSelect={handleDestinationSelect}
        callDestinationPoiId={callDestinationPoiId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  closeButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  miniIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noteInput: {
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
