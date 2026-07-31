import { Building2, Check, ChevronDown, ChevronRight, ChevronUp, MapPinned, Phone, Send, Truck, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DestinationTab, getDefaultDestinationTab, getDestinationCapabilities } from '@/lib/destination-helpers';
import { getPoiSelectionLabel } from '@/lib/poi-display';
import { resolveUnitStatusOptions } from '@/lib/unit-status-helpers';
import { invertColor, isCallActive } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useCallsStore } from '@/stores/calls/store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';
import { useUnitsStore } from '@/stores/units/store';

interface UnitActionsPanelProps {
  unit?: UnitInfoResultData | null;
  onStatusUpdated?: () => void;
}

// Reusable status option for the action sheet
const StatusSheetOption: React.FC<{
  status: StatusesResultData;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ status, isSelected, onSelect }) => {
  const bgColor = status.BColor || '#6b7280';
  const textColor = invertColor(bgColor, true);

  return (
    <Pressable onPress={onSelect}>
      <HStack
        className={`mb-2 items-center justify-between rounded-lg border-2 px-3 py-2.5 ${
          isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }`}
      >
        <HStack className="items-center" space="sm">
          <View style={StyleSheet.flatten([styles.statusIndicator, { backgroundColor: bgColor }])}>
            <Text style={{ color: textColor }} className="text-sm font-bold">
              {status.Text.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <VStack className="flex-1">
            <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{status.Text}</Text>
            {status.Detail > 0 ? (
              <Text className="text-xs text-gray-500 dark:text-gray-400">{status.Detail === 1 ? 'Station destination' : status.Detail === 2 ? 'Call destination' : 'Call or Station destination'}</Text>
            ) : null}
          </VStack>
        </HStack>
        {isSelected ? (
          <View style={StyleSheet.flatten([styles.checkIcon, { backgroundColor: '#3b82f6' }])}>
            <Icon as={Check} size="sm" color="#fff" />
          </View>
        ) : null}
      </HStack>
    </Pressable>
  );
};

// Destination option for the action sheet
const DestinationSheetOption: React.FC<{
  type: 'call' | 'station' | 'poi' | 'none';
  item?: CallResultData | GroupResultData | PoiResultData;
  isSelected: boolean;
  onSelect: () => void;
  label?: string;
}> = ({ type, item, isSelected, onSelect, label }) => {
  const isCall = type === 'call';
  const isPoi = type === 'poi';
  const isNone = type === 'none';
  const call = isCall && item ? (item as CallResultData) : null;
  const poi = isPoi && item ? (item as PoiResultData) : null;
  const station = !isCall && !isPoi && !isNone && item ? (item as GroupResultData) : null;

  return (
    <Pressable onPress={onSelect}>
      <HStack
        className={`mb-2 items-center justify-between rounded-lg border px-3 py-2.5 ${
          isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }`}
      >
        <HStack className="flex-1 items-center" space="sm">
          {isNone ? (
            <Icon as={X} size="sm" className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
          ) : (
            <Icon as={isCall ? Phone : isPoi ? MapPinned : Building2} size="sm" className={isSelected ? 'text-blue-500' : 'text-gray-500'} />
          )}
          <Text className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
            {isNone ? label : isCall ? `#${call?.Number} - ${call?.Name}` : isPoi ? getPoiSelectionLabel(poi!) : station?.Name}
          </Text>
        </HStack>
        {isSelected ? <Icon as={Check} size="sm" className="text-blue-500" /> : null}
      </HStack>
    </Pressable>
  );
};

export const UnitActionsPanel: React.FC<UnitActionsPanelProps> = ({ unit: unitProp, onStatusUpdated }) => {
  const { t } = useTranslation();

  // Get calls directly from calls store using selector
  const calls = useCallsStore((state) => state.calls);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);

  // Local state for action sheets
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isDestinationSheetOpen, setIsDestinationSheetOpen] = useState(false);
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(false);
  const [destinationTab, setDestinationTab] = useState<DestinationTab>('calls');

  // Local state for selected status (to fix synchronization issues)
  const [localSelectedStatus, setLocalSelectedStatus] = useState<StatusesResultData | null>(null);

  // Store state
  const {
    selectedUnit: storeSelectedUnit,
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

  // Load options when panel opens
  useEffect(() => {
    if (!selectedUnit) return;

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
        const serverStatuses = (unitStatusData?.Data?.Statuses as unknown as StatusesResultData[]) || [];
        setAvailableStatuses(resolveUnitStatusOptions(selectedUnit, groups, serverStatuses));
        setAvailableCalls(unitStatusData?.Data?.Calls || []);
        setAvailableStations(unitStatusData?.Data?.Stations || []);
        setAvailablePois(unitStatusData?.Data?.DestinationPois || []);
      } catch (error) {
        console.error('Failed to load unit action options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    if (selectedUnit) {
      loadOptions();
    }
  }, [selectedUnit, setAvailableStatuses, setAvailableCalls, setAvailableStations, setAvailablePois, setIsLoadingOptions]);

  // Update available calls from calls store
  useEffect(() => {
    const activeCalls = calls.filter((c) => isCallActive(c.State));
    setAvailableCalls(activeCalls);
  }, [calls, setAvailableCalls]);

  // Track the last unit ID we initialized destination for
  const lastInitializedUnitIdRef = useRef<string | null>(null);

  // Initialize destination from selected unit's current destination (only once per unit)
  useEffect(() => {
    if (!selectedUnit) {
      lastInitializedUnitIdRef.current = null;
      return;
    }

    // Only initialize once per unit - skip if we already initialized for this unit
    if (lastInitializedUnitIdRef.current === selectedUnit.UnitId) {
      return;
    }

    // If no destination set, just mark as initialized
    if (!selectedUnit.CurrentDestinationId) {
      lastInitializedUnitIdRef.current = selectedUnit.UnitId;
      return;
    }

    const destinationId = selectedUnit.CurrentDestinationId;

    // Check if the destination is a call (check available calls)
    const matchingCall = calls.find((c) => c.CallId === destinationId);
    if (matchingCall) {
      setStatusDestinationType('call');
      setStatusSelectedCall(matchingCall);
      setStatusSelectedStation(null);
      lastInitializedUnitIdRef.current = selectedUnit.UnitId;
      return;
    }

    // Check if the destination is a station (check available stations)
    const matchingStation = availableStations.find((s) => s.GroupId === destinationId);
    if (matchingStation) {
      setStatusDestinationType('station');
      setStatusSelectedStation(matchingStation);
      setStatusSelectedCall(null);
      lastInitializedUnitIdRef.current = selectedUnit.UnitId;
      return;
    }

    const matchingPoi = availablePois.find((poi) => poi.PoiId.toString() === destinationId);
    if (matchingPoi) {
      setStatusDestinationType('poi');
      setStatusSelectedPoi(matchingPoi);
      lastInitializedUnitIdRef.current = selectedUnit.UnitId;
      return;
    }

    // If we couldn't match but have data loaded, mark as initialized anyway
    if (calls.length > 0 || availableStations.length > 0 || availablePois.length > 0) {
      lastInitializedUnitIdRef.current = selectedUnit.UnitId;
    }
  }, [selectedUnit, calls, availableStations, availablePois, setStatusDestinationType, setStatusSelectedCall, setStatusSelectedStation, setStatusSelectedPoi]);

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

  // Get destination display text
  const getDestinationDisplay = useMemo(() => {
    if (statusDestinationType === 'call' && statusSelectedCall) {
      return `#${statusSelectedCall.Number} - ${statusSelectedCall.Name}`;
    }
    if (statusDestinationType === 'station' && statusSelectedStation) {
      return statusSelectedStation.Name;
    }
    if (statusDestinationType === 'poi' && statusSelectedPoi) {
      return getPoiSelectionLabel(statusSelectedPoi);
    }
    return t('dispatch.unit_actions_panel.no_destination');
  }, [statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, t]);

  // Check destination type allowed based on Detail
  const destinationConfig = useMemo(() => {
    return getDestinationCapabilities(selectedStatus?.Detail);
  }, [selectedStatus]);

  // Check note requirement based on Note field
  // Note: 0 = No note, 1 = Optional, 2 = Required
  const statusNoteConfig = useMemo(() => {
    if (!selectedStatus) return { show: true, required: false };
    return {
      show: true,
      required: selectedStatus.Note === 2,
    };
  }, [selectedStatus]);

  // Validate status can be submitted
  const canSubmitStatus = useMemo(() => {
    if (!selectedStatus) return false;
    // Check if note is required and not provided
    if (selectedStatus.Note === 2 && !statusNote.trim()) return false;
    return true;
  }, [selectedStatus, statusNote]);

  // Active calls for destination selection
  const activeCalls = useMemo(() => {
    return calls.filter((c) => isCallActive(c.State));
  }, [calls]);

  useEffect(() => {
    if (selectedStatus) {
      setDestinationTab(getDefaultDestinationTab(selectedStatus.Detail));
    }
  }, [selectedStatus]);

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
    // If status requires destination, open destination sheet
    if (getDestinationCapabilities(status.Detail).supportsDestination) {
      setTimeout(() => setIsDestinationSheetOpen(true), 300);
    }
  };

  // Handle destination selection
  const handleDestinationSelect = (type: 'none' | 'call' | 'station' | 'poi', item?: CallResultData | GroupResultData | PoiResultData) => {
    if (type === 'none') {
      setStatusDestinationType('none');
      setStatusSelectedCall(null);
      setStatusSelectedStation(null);
      setStatusSelectedPoi(null);
    } else if (type === 'call' && item) {
      setStatusSelectedCall(item as CallResultData);
    } else if (type === 'station' && item) {
      setStatusSelectedStation(item as GroupResultData);
    } else if (type === 'poi' && item) {
      setStatusSelectedPoi(item as PoiResultData);
    }
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
              <Icon as={Truck} size="xs" className="text-blue-500" />
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
                <HStack className="items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <HStack className="flex-1 items-center" space="sm">
                    <Icon as={statusDestinationType === 'call' ? Phone : statusDestinationType === 'poi' ? MapPinned : Building2} size="sm" className="text-amber-500" />
                    <VStack className="flex-1">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.destination')}</Text>
                      <Text className="text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
                        {getDestinationDisplay}
                      </Text>
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
              placeholder={`${t('dispatch.unit_actions_panel.note')}${statusNoteConfig.required ? ' *' : ` (${t('common.optional')})`}`}
              placeholderTextColor="#9ca3af"
              value={statusNote}
              onChangeText={setStatusNote}
            />

            {/* Update Status Button */}
            {selectedStatus ? (
              <>
                {statusError ? <Text className="text-xs text-red-500">{statusError}</Text> : null}
                <Button size="sm" onPress={handleSubmitStatus} isDisabled={!canSubmitStatus || isSubmittingStatus} className="bg-blue-600">
                  {isSubmittingStatus ? <ButtonSpinner color="white" /> : <Icon as={Send} size="xs" color="white" />}
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

      {/* Status Selection Action Sheet */}
      <Actionsheet isOpen={isStatusSheetOpen} onClose={() => setIsStatusSheetOpen(false)} snapPoints={[50]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="rounded-t-2xl bg-white px-4 pb-6 dark:bg-gray-900">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full" space="md">
            <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('dispatch.unit_actions_panel.select_status')}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {availableStatuses.length === 0 ? (
                <Text className="py-4 text-center text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.no_statuses_available')}</Text>
              ) : (
                availableStatuses.map((status) => <StatusSheetOption key={status.Id} status={status} isSelected={selectedStatus?.Id === status.Id} onSelect={() => handleStatusSelect(status)} />)
              )}
            </ScrollView>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {/* Destination Selection Action Sheet */}
      <Actionsheet isOpen={isDestinationSheetOpen} onClose={() => setIsDestinationSheetOpen(false)} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="flex-1 rounded-t-2xl bg-white px-4 pb-6 dark:bg-gray-900">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full flex-1" space="sm">
            <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('dispatch.unit_actions_panel.destination')}</Text>

            {/* No Destination Option */}
            <DestinationSheetOption type="none" isSelected={statusDestinationType === 'none'} onSelect={() => handleDestinationSelect('none')} label={t('dispatch.unit_actions_panel.no_destination')} />

            {/* Tabs for Calls and Stations */}
            {destinationConfig.showCalls || destinationConfig.showStations || destinationConfig.showPois ? (
              <>
                <HStack className="rounded-lg bg-gray-100 p-1 dark:bg-gray-800" space="xs">
                  {destinationConfig.showCalls ? (
                    <Pressable onPress={() => setDestinationTab('calls')} className={`flex-1 rounded-md px-3 py-2 ${destinationTab === 'calls' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                      <Text className={`text-center text-sm font-medium ${destinationTab === 'calls' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('dispatch.calls')} ({activeCalls.length})
                      </Text>
                    </Pressable>
                  ) : null}
                  {destinationConfig.showStations ? (
                    <Pressable onPress={() => setDestinationTab('stations')} className={`flex-1 rounded-md px-3 py-2 ${destinationTab === 'stations' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                      <Text className={`text-center text-sm font-medium ${destinationTab === 'stations' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('dispatch.stations')} ({availableStations.length})
                      </Text>
                    </Pressable>
                  ) : null}
                  {destinationConfig.showPois ? (
                    <Pressable onPress={() => setDestinationTab('pois')} className={`flex-1 rounded-md px-3 py-2 ${destinationTab === 'pois' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                      <Text className={`text-center text-sm font-medium ${destinationTab === 'pois' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('menu.pois')} ({availablePois.length})
                      </Text>
                    </Pressable>
                  ) : null}
                </HStack>

                {/* Tab Content */}
                <ScrollView className="flex-1 pb-5" showsVerticalScrollIndicator>
                  {/* Calls Tab Content */}
                  {destinationTab === 'calls' && destinationConfig.showCalls ? (
                    <VStack space="xs">
                      {activeCalls.length > 0 ? (
                        activeCalls.map((call) => (
                          <DestinationSheetOption
                            key={call.CallId}
                            type="call"
                            item={call}
                            isSelected={statusDestinationType === 'call' && statusSelectedCall?.CallId === call.CallId}
                            onSelect={() => handleDestinationSelect('call', call)}
                          />
                        ))
                      ) : (
                        <Text className="py-8 text-center text-sm text-gray-400">{t('dispatch.unit_actions_panel.no_active_calls')}</Text>
                      )}
                    </VStack>
                  ) : null}

                  {/* Stations Tab Content */}
                  {destinationTab === 'stations' && destinationConfig.showStations ? (
                    <VStack space="xs">
                      {availableStations.length > 0 ? (
                        availableStations.map((station) => (
                          <DestinationSheetOption
                            key={station.GroupId}
                            type="station"
                            item={station}
                            isSelected={statusDestinationType === 'station' && statusSelectedStation?.GroupId === station.GroupId}
                            onSelect={() => handleDestinationSelect('station', station)}
                          />
                        ))
                      ) : (
                        <Text className="py-8 text-center text-sm text-gray-400">{t('dispatch.unit_actions_panel.no_stations_available')}</Text>
                      )}
                    </VStack>
                  ) : null}

                  {destinationTab === 'pois' && destinationConfig.showPois ? (
                    <VStack space="xs">
                      {availablePois.length > 0 ? (
                        availablePois.map((poi) => (
                          <DestinationSheetOption
                            key={poi.PoiId}
                            type="poi"
                            item={poi}
                            isSelected={statusDestinationType === 'poi' && statusSelectedPoi?.PoiId === poi.PoiId}
                            onSelect={() => handleDestinationSelect('poi', poi)}
                          />
                        ))
                      ) : (
                        <Text className="py-8 text-center text-sm text-gray-400">{t('status.no_pois_available')}</Text>
                      )}
                    </VStack>
                  ) : null}
                </ScrollView>
              </>
            ) : (
              <Text className="py-4 text-center text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.no_destinations_available')}</Text>
            )}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
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
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: {
    maxHeight: 300,
  },
  noteInput: {
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
