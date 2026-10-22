import { Building2, ChevronRight, Layers, MapPinned, Phone, Send, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DestinationSelectionType, type DestinationTab, getDefaultDestinationTab, getEffectiveDestinationType, getStatusDestinationCapabilities, resolveDefaultDestinationCall } from '@/lib/destination-helpers';
import { getPoiSelectionLabel } from '@/lib/poi-display';
import { type CommonUnitStatusOption, resolveCommonUnitStatusOptions } from '@/lib/unit-status-helpers';
import { isCallActive } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useCallsStore } from '@/stores/calls/store';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitBulkActionsStore } from '@/stores/dispatch/unit-bulk-actions-store';
import { useUnitsStore } from '@/stores/units/store';

import { UnitDestinationSheet, UnitStatusSheet } from './unit-status-sheets';

interface BulkUnitActionsPanelProps {
  onStatusUpdated?: () => void;
}

interface DestinationOptions {
  statuses: StatusesResultData[];
  stations: GroupResultData[];
  pois: PoiResultData[];
}

/**
 * Sets one status (with one destination and note) for every unit of a multi-unit selection, e.g. an ambulance and the
 * MUG that follows it to the hospital, or all apparatus returning from a fire. Only the statuses every selected unit
 * has are offered; each unit is sent its own status id and only the destination its own status accepts.
 */
export const BulkUnitActionsPanel: React.FC<BulkUnitActionsPanelProps> = ({ onStatusUpdated }) => {
  const { t } = useTranslation();

  const units = useUnitsStore((s) => s.units);
  const unitStatusGroups = useUnitsStore((s) => s.unitStatuses);
  const calls = useCallsStore((s) => s.calls);
  const fetchCalls = useCallsStore((s) => s.fetchCalls);
  const selectedCallId = useDispatchConsoleStore((s) => s.selectedCallId);

  const {
    selectedUnitIds,
    selectedStatusKey,
    statusDestinationType,
    statusSelectedCall,
    statusSelectedStation,
    statusSelectedPoi,
    statusNote,
    isSubmitting,
    statusError,
    failedUnitIds,
    endSelection,
    toggleUnit,
    setSelectedStatusKey,
    applyDefaultDestinationCall,
    chooseDestination,
    setStatusNote,
    submitStatus,
  } = useUnitBulkActionsStore();

  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isDestinationSheetOpen, setIsDestinationSheetOpen] = useState(false);
  const [destinationTab, setDestinationTab] = useState<DestinationTab>('calls');
  // The destination sheet opens a beat after the status sheet closes
  const destinationSheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastUpdate, setLastUpdate] = useState<{ status: string; count: number } | null>(null);

  const selectedUnits = useMemo(() => selectedUnitIds.map((id) => units.find((u) => u.UnitId === id)).filter((u): u is UnitInfoResultData => !!u), [selectedUnitIds, units]);

  // Stations and POIs are the department's, so one unit's options serve the whole selection; its status list is only
  // the fallback for when the grouped unit statuses are missing.
  const optionsUnitId = selectedUnits[0]?.UnitId;
  const [options, setOptions] = useState<DestinationOptions>({ statuses: [], stations: [], pois: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false);

  useEffect(() => {
    if (!optionsUnitId || hasLoadedOptions) return;

    let cancelled = false;
    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [unitStatusData] = await Promise.all([getSetUnitStatusData(optionsUnitId), useUnitsStore.getState().unitStatuses?.length ? Promise.resolve() : useUnitsStore.getState().fetchUnits()]);
        if (cancelled) return;
        setOptions({
          statuses: (unitStatusData?.Data?.Statuses as unknown as StatusesResultData[]) || [],
          stations: unitStatusData?.Data?.Stations || [],
          pois: unitStatusData?.Data?.DestinationPois || [],
        });
      } catch (error) {
        console.error('Failed to load bulk unit action options:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
          setHasLoadedOptions(true);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [optionsUnitId, hasLoadedOptions]);

  useEffect(
    () => () => {
      if (destinationSheetTimerRef.current) clearTimeout(destinationSheetTimerRef.current);
    },
    []
  );

  const commonStatuses = useMemo(() => resolveCommonUnitStatusOptions(selectedUnits, unitStatusGroups, options.statuses), [selectedUnits, unitStatusGroups, options.statuses]);
  const selectedOption: CommonUnitStatusOption | null = useMemo(() => commonStatuses.find((option) => option.key === selectedStatusKey) ?? null, [commonStatuses, selectedStatusKey]);
  // The sheet lists each option as the first unit's status, with the destinations any unit's status accepts
  const sheetStatuses = useMemo(() => commonStatuses.map((option) => ({ ...option.status, Detail: option.detail })), [commonStatuses]);

  const activeCalls = useMemo(() => calls.filter((c) => isCallActive(c.State)), [calls]);

  // A unit working a call the calls list does not have yet: refresh the calls once, so the shared call can be the default
  const hasMissingWorkingCall = selectedUnits.some((u) => !!u.ActiveCallId && !activeCalls.some((c) => c.CallId === u.ActiveCallId));
  const hasRefetchedCallsRef = useRef(false);
  useEffect(() => {
    if (hasMissingWorkingCall && !hasRefetchedCallsRef.current) {
      hasRefetchedCallsRef.current = true;
      void fetchCalls();
    }
  }, [hasMissingWorkingCall, fetchCalls]);

  // The default destination is the call all selected units are working (or headed to); with no shared call there is
  // none, and the dispatcher picks one. A destination the dispatcher chose is kept (see applyDefaultDestinationCall).
  const defaultCall = useMemo(() => {
    const perUnit = selectedUnits.map((u) =>
      resolveDefaultDestinationCall({ workingCallId: u.ActiveCallId, currentDestinationId: u.CurrentDestinationId, currentDestinationType: u.CurrentDestinationType, selectedCallId, activeCalls })
    );
    const first = perUnit[0];
    return first && perUnit.every((call) => call?.CallId === first.CallId) ? first : null;
  }, [selectedUnits, selectedCallId, activeCalls]);

  useEffect(() => {
    applyDefaultDestinationCall(defaultCall);
  }, [defaultCall, applyDefaultDestinationCall]);

  const destinationSelection = useMemo(
    () => ({ selectedDestinationType: statusDestinationType, selectedCall: statusSelectedCall, selectedStation: statusSelectedStation, selectedPoi: statusSelectedPoi }),
    [statusDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi]
  );
  const destinationConfig = useMemo(() => getStatusDestinationCapabilities(selectedOption?.detail), [selectedOption]);
  const effectiveDestinationType = useMemo(() => getEffectiveDestinationType(destinationSelection, selectedOption?.detail), [destinationSelection, selectedOption]);

  const destinationDisplay = useMemo(() => {
    if (effectiveDestinationType === 'call' && statusSelectedCall) return `#${statusSelectedCall.Number} - ${statusSelectedCall.Name}`;
    if (effectiveDestinationType === 'station' && statusSelectedStation) return statusSelectedStation.Name;
    if (effectiveDestinationType === 'poi' && statusSelectedPoi) return getPoiSelectionLabel(statusSelectedPoi);
    return t('dispatch.unit_actions_panel.no_destination');
  }, [effectiveDestinationType, statusSelectedCall, statusSelectedStation, statusSelectedPoi, t]);

  // Each unit's own status for the chosen option
  const targets = useMemo(
    () => (selectedOption ? selectedUnits.filter((u) => !!selectedOption.statusByUnitId[u.UnitId]).map((u) => ({ unitId: u.UnitId, status: selectedOption.statusByUnitId[u.UnitId] })) : []),
    [selectedOption, selectedUnits]
  );
  const isRetry = failedUnitIds.length > 0;
  const submitCount = isRetry ? failedUnitIds.length : targets.length;
  const canSubmit = !!selectedOption && targets.length > 0 && (!selectedOption.noteRequired || !!statusNote.trim()) && !isSubmitting;

  const failedUnitNames = useMemo(() => selectedUnits.filter((u) => failedUnitIds.includes(u.UnitId)).map((u) => u.Name), [selectedUnits, failedUnitIds]);

  useEffect(() => {
    if (selectedOption) {
      setDestinationTab(getDefaultDestinationTab(selectedOption.detail));
    }
  }, [selectedOption]);

  const handleStatusSelect = (status: StatusesResultData) => {
    const option = commonStatuses.find((candidate) => candidate.status.Id === status.Id);
    if (!option) return;
    setSelectedStatusKey(option.key);
    setLastUpdate(null);
    setIsStatusSheetOpen(false);
    // A status that takes a destination, with none that applies yet: open the destination sheet
    if (getStatusDestinationCapabilities(option.detail).supportsDestination && getEffectiveDestinationType(destinationSelection, option.detail) === 'none') {
      if (destinationSheetTimerRef.current) clearTimeout(destinationSheetTimerRef.current);
      destinationSheetTimerRef.current = setTimeout(() => {
        destinationSheetTimerRef.current = null;
        setIsDestinationSheetOpen(true);
      }, 300);
    }
  };

  const handleDestinationSelect = (type: DestinationSelectionType, item?: CallResultData | GroupResultData | PoiResultData) => {
    chooseDestination(type, item);
    setIsDestinationSheetOpen(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedOption) return;
    const statusText = selectedOption.status.Text;
    const success = await submitStatus(targets);
    if (success) {
      setLastUpdate({ status: statusText, count: submitCount });
    }
    // Refresh even after a partial failure: the other units did change
    onStatusUpdated?.();
  }, [selectedOption, submitStatus, targets, submitCount, onStatusUpdated]);

  if (selectedUnits.length === 0) {
    return null;
  }

  return (
    <>
      <Box className="rounded-lg border border-indigo-300 bg-white dark:border-indigo-700 dark:bg-gray-900" testID="bulk-unit-actions-panel">
        {/* Header with the selected units */}
        <VStack className="border-b border-gray-200 px-2 py-1.5 dark:border-gray-700" space="xs">
          <HStack className="items-center justify-between">
            <HStack className="flex-1 items-center" space="xs">
              <View style={styles.avatar}>
                <Icon as={Layers} size="xs" className="text-indigo-500" />
              </View>
              <Text className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
                {t('dispatch.bulk_unit_actions.title', { count: selectedUnits.length })}
              </Text>
            </HStack>
            <Pressable onPress={endSelection} style={styles.closeButton} accessibilityLabel={t('common.close')} testID="bulk-unit-actions-close">
              <Icon as={X} size="xs" className="text-gray-500" />
            </Pressable>
          </HStack>
          <HStack className="flex-wrap" space="xs">
            {selectedUnits.map((unit) => (
              <Pressable
                key={unit.UnitId}
                onPress={() => toggleUnit(unit.UnitId)}
                accessibilityLabel={t('dispatch.bulk_unit_actions.remove_unit', { name: unit.Name })}
                testID={`bulk-unit-chip-${unit.UnitId}`}
                style={styles.chip}
              >
                <HStack
                  className={`items-center rounded-full border px-2 py-0.5 ${failedUnitIds.includes(unit.UnitId) ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950' : 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950'}`}
                  space="xs"
                >
                  <Text className="text-xs font-medium text-gray-800 dark:text-gray-100">{unit.Name}</Text>
                  <Icon as={X} size="2xs" className="text-gray-400" />
                </HStack>
              </Pressable>
            ))}
          </HStack>
        </VStack>

        {isLoadingOptions ? (
          <VStack className="items-center justify-center p-4" space="xs">
            <Spinner size="small" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</Text>
          </VStack>
        ) : (
          <VStack className="p-2" space="xs">
            {/* Status Selection Button */}
            <Pressable onPress={() => setIsStatusSheetOpen(true)} testID="bulk-unit-status-button">
              <HStack className="items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <HStack className="flex-1 items-center" space="sm">
                  <Icon as={Layers} size="sm" className="text-indigo-500" />
                  <VStack className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.status')}</Text>
                    {selectedOption ? (
                      <HStack className="items-center" space="xs">
                        <View style={StyleSheet.flatten([styles.miniIndicator, { backgroundColor: selectedOption.status.BColor || '#6b7280' }])} />
                        <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{selectedOption.status.Text}</Text>
                      </HStack>
                    ) : (
                      <Text className="text-sm text-gray-400 dark:text-gray-500">{t('dispatch.unit_actions_panel.select_status')}</Text>
                    )}
                  </VStack>
                </HStack>
                <Icon as={ChevronRight} size="sm" className="text-gray-400" />
              </HStack>
            </Pressable>
            {commonStatuses.length === 0 ? <Text className="text-xs text-amber-600 dark:text-amber-400">{t('dispatch.bulk_unit_actions.no_common_statuses')}</Text> : null}

            {/* Destination Button (only when the selected status supports one) */}
            {selectedOption && destinationConfig.supportsDestination ? (
              <Pressable onPress={() => setIsDestinationSheetOpen(true)} testID="bulk-unit-destination-button">
                <HStack className="items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <HStack className="flex-1 items-center" space="sm">
                    <Icon as={effectiveDestinationType === 'call' ? Phone : effectiveDestinationType === 'poi' ? MapPinned : Building2} size="sm" className="text-amber-500" />
                    <VStack className="flex-1">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.destination')}</Text>
                      <Text className="text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
                        {destinationDisplay}
                      </Text>
                    </VStack>
                  </HStack>
                  <Icon as={ChevronRight} size="sm" className="text-gray-400" />
                </HStack>
              </Pressable>
            ) : null}

            <TextInput
              style={styles.noteInput}
              className={`rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100 ${
                selectedOption?.noteRequired && !statusNote.trim() ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
              }`}
              placeholder={`${t('dispatch.unit_actions_panel.note')}${selectedOption?.noteRequired ? ' *' : ` (${t('common.optional')})`}`}
              placeholderTextColor="#9ca3af"
              value={statusNote}
              onChangeText={setStatusNote}
            />

            {lastUpdate && !selectedOption ? (
              <Text className="text-xs text-green-600 dark:text-green-400" testID="bulk-unit-actions-success">
                {t('dispatch.bulk_unit_actions.success', { status: lastUpdate.status, count: lastUpdate.count })}
              </Text>
            ) : null}

            {selectedOption ? (
              <>
                {failedUnitNames.length > 0 ? (
                  <Text className="text-xs text-red-500" testID="bulk-unit-actions-failure">
                    {t('dispatch.bulk_unit_actions.partial_failure', { units: failedUnitNames.join(', ') })}
                  </Text>
                ) : null}
                {statusError ? <Text className="text-xs text-red-500">{statusError}</Text> : null}
                <Button size="sm" onPress={handleSubmit} isDisabled={!canSubmit} className="bg-indigo-600">
                  {isSubmitting ? <ButtonSpinner color="white" /> : <Icon as={Send} size="xs" color="white" />}
                  <ButtonText className="ml-1 text-xs">{isRetry ? t('dispatch.bulk_unit_actions.retry_failed', { count: submitCount }) : t('dispatch.bulk_unit_actions.update_status', { count: submitCount })}</ButtonText>
                </Button>
              </>
            ) : null}
          </VStack>
        )}
      </Box>

      <UnitStatusSheet isOpen={isStatusSheetOpen} onClose={() => setIsStatusSheetOpen(false)} statuses={sheetStatuses} selectedStatusId={selectedOption?.status.Id} onSelect={handleStatusSelect} />

      <UnitDestinationSheet
        isOpen={isDestinationSheetOpen}
        onClose={() => setIsDestinationSheetOpen(false)}
        capabilities={destinationConfig}
        activeTab={destinationTab}
        onTabChange={setDestinationTab}
        calls={activeCalls}
        stations={options.stations}
        pois={options.pois}
        effectiveDestinationType={effectiveDestinationType}
        selectedCall={statusSelectedCall}
        selectedStation={statusSelectedStation}
        selectedPoi={statusSelectedPoi}
        onSelect={handleDestinationSelect}
      />
    </>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#6366f1',
  },
  closeButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  chip: {
    marginBottom: 2,
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
