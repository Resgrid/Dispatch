import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, TouchableOpacity } from 'react-native';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { DestinationEntityType, type DestinationTab, getDefaultDestinationTab, getDestinationCapabilities, getEnabledDestinationTabs } from '@/lib/destination-helpers';
import { getPoiSelectionLabel } from '@/lib/poi-display';
import { invertColor } from '@/lib/utils';
import { type CustomStatusResultData } from '@/models/v4/customStatuses/customStatusResultData';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useRolesStore } from '@/stores/roles/store';
import { useStatusBottomSheetStore, useStatusesStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonText } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

export const StatusBottomSheet = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const keyboardHeight = useKeyboardHeight();
  const [selectedTab, setSelectedTab] = React.useState<DestinationTab>('calls');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const hasPreselectedRef = React.useRef(false);
  const { showToast } = useToastStore();

  const {
    isOpen,
    currentStep,
    selectedCall,
    selectedStation,
    selectedPoi,
    selectedDestinationType,
    selectedStatus,
    cameFromStatusSelection,
    note,
    availableCalls,
    availableStations,
    availablePois,
    availableStatuses,
    isLoading,
    setIsOpen,
    setCurrentStep,
    setSelectedCall,
    setSelectedStation,
    setSelectedPoi,
    setSelectedDestinationType,
    setSelectedStatus,
    setNote,
    fetchDestinationData,
    reset,
  } = useStatusBottomSheetStore();

  const { activeUnit, activeCallId, setActiveCall } = useCoreStore();
  const { unitRoleAssignments } = useRolesStore();
  const { saveUnitStatus } = useStatusesStore();
  const { latitude, longitude, heading, accuracy, speed, altitude, timestamp } = useLocationStore();

  // Helper function to safely get status properties
  const getStatusProperty = React.useCallback(
    (prop: 'Detail' | 'Note', defaultValue: number): number => {
      if (!selectedStatus) return defaultValue;
      return selectedStatus[prop] ?? defaultValue;
    },
    [selectedStatus]
  );

  const getStatusId = React.useCallback((): string => {
    if (!selectedStatus) return '0';
    return selectedStatus.Id.toString();
  }, [selectedStatus]);

  const handleClose = () => {
    reset();
  };

  const handleCallSelect = (callId: string) => {
    const call = availableCalls.find((c) => c.CallId === callId);
    if (call) {
      setSelectedCall(call);
      setSelectedDestinationType('call');
      setSelectedStation(null);
      setSelectedPoi(null);
    }
  };

  const handleStationSelect = (stationId: string) => {
    const station = availableStations.find((s) => s.GroupId === stationId);
    if (station) {
      setSelectedStation(station);
      setSelectedDestinationType('station');
      setSelectedCall(null);
      setSelectedPoi(null);
    }
  };

  const handlePoiSelect = (poiId: number) => {
    const poi = availablePois.find((currentPoi) => currentPoi.PoiId === poiId);
    if (poi) {
      setSelectedPoi(poi);
      setSelectedDestinationType('poi');
      setSelectedCall(null);
      setSelectedStation(null);
    }
  };

  const handleNoDestinationSelect = () => {
    setSelectedDestinationType('none');
    setSelectedCall(null);
    setSelectedStation(null);
    setSelectedPoi(null);
  };

  const handleNext = () => {
    if (!canProceedFromCurrentStep()) {
      return;
    }

    if (currentStep === 'select-status') {
      // Move to destination selection after status is selected
      const detailLevel = getStatusProperty('Detail', 0);
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
      } else {
        // Check if note is required/optional based on selectedStatus
        const noteType = getStatusProperty('Note', 0);
        if (noteType === 0) {
          // No note step, go straight to submission
          handleSubmit();
        } else {
          // Note step required (noteType 1 = optional, noteType 2 = required)
          setCurrentStep('add-note');
        }
      }
    } else if (currentStep === 'select-destination') {
      // Check if note is required/optional based on selectedStatus
      const noteType = getStatusProperty('Note', 0);
      if (noteType === 0) {
        // No note step, go straight to submission
        handleSubmit();
      } else {
        // Note step required (noteType 1 = optional, noteType 2 = required)
        setCurrentStep('add-note');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep === 'add-note') {
      const detailLevel = getStatusProperty('Detail', 0);
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
      } else {
        setCurrentStep('select-status');
      }
    } else if (currentStep === 'select-destination') {
      setCurrentStep('select-status');
    }
  };

  const handleStatusSelect = (statusId: string) => {
    const status = availableStatuses.find((s) => s.Id.toString() === statusId);
    if (status) {
      setSelectedStatus(status);
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (isSubmitting) return; // Prevent double submission

    try {
      if (!selectedStatus || !activeUnit) return;

      setIsSubmitting(true);

      const input = new SaveUnitStatusInput();
      input.Id = activeUnit.UnitId;
      input.Type = getStatusId();
      input.Note = note;

      // Set RespondingTo based on destination selection
      if (selectedDestinationType === 'call' && selectedCall) {
        input.RespondingTo = selectedCall.CallId;
        input.RespondingToType = DestinationEntityType.Call;
      } else if (selectedDestinationType === 'station' && selectedStation) {
        input.RespondingTo = selectedStation.GroupId;
        input.RespondingToType = DestinationEntityType.Station;
      } else if (selectedDestinationType === 'poi' && selectedPoi) {
        input.RespondingTo = selectedPoi.PoiId.toString();
        input.RespondingToType = DestinationEntityType.Poi;
      } else {
        input.RespondingTo = '';
        input.RespondingToType = null;
      }

      // Include GPS coordinates if available
      if (latitude !== null && longitude !== null) {
        input.Latitude = latitude.toString();
        input.Longitude = longitude.toString();
        input.Accuracy = accuracy?.toString() || '0';
        input.Altitude = altitude?.toString() || '0';
        input.AltitudeAccuracy = ''; // Location store doesn't provide altitude accuracy
        input.Speed = speed?.toString() || '0';
        input.Heading = heading?.toString() || '0';

        // Set timestamp from location if available, otherwise use current time
        if (timestamp) {
          const locationDate = new Date(timestamp);
          input.Timestamp = locationDate.toISOString();
          input.TimestampUtc = locationDate.toUTCString().replace('UTC', 'GMT');
        }
      }

      // Add role assignments
      input.Roles = unitRoleAssignments.map((assignment) => {
        const roleInput = new SaveUnitStatusRoleInput();
        roleInput.RoleId = assignment.UnitRoleId;
        roleInput.UserId = assignment.UserId;
        return roleInput;
      });

      // Set active call if a call was selected and it's different from the current active call
      if (selectedDestinationType === 'call' && selectedCall && activeCallId !== selectedCall.CallId) {
        setActiveCall(selectedCall.CallId);
      }

      await saveUnitStatus(input);

      // Show success toast
      showToast('success', t('status.status_saved_successfully'));

      reset();
    } catch (error) {
      console.error('Failed to save unit status:', error);
      // Show error toast
      showToast('error', t('status.failed_to_save_status'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    selectedStatus,
    activeUnit,
    note,
    selectedDestinationType,
    selectedCall,
    selectedStation,
    selectedPoi,
    unitRoleAssignments,
    saveUnitStatus,
    reset,
    getStatusId,
    latitude,
    longitude,
    heading,
    accuracy,
    speed,
    altitude,
    timestamp,
    activeCallId,
    setActiveCall,
    showToast,
    t,
  ]);

  // Fetch destination data when the status bottom sheet opens. This must run regardless of
  // whether a status is pre-selected so the no-status flow can populate availableStatuses for
  // the select-status picker (as well as the calls/stations/POIs for the destination step).
  React.useEffect(() => {
    if (isOpen && activeUnit) {
      fetchDestinationData(activeUnit.UnitId);
    }
  }, [isOpen, activeUnit, fetchDestinationData]);

  React.useEffect(() => {
    if (!selectedStatus) {
      return;
    }

    setSelectedTab(getDefaultDestinationTab(selectedStatus.Detail));
  }, [selectedStatus]);

  // Pre-select active call when opening with calls enabled
  React.useLayoutEffect(() => {
    // Reset the pre-selection flag when bottom sheet closes
    if (!isOpen) {
      hasPreselectedRef.current = false;
      return;
    }

    // Immediate pre-selection: if we have the conditions met, pre-select right away
    // This runs on every render to catch the case where availableCalls loads in
    const capabilities = getDestinationCapabilities(selectedStatus?.Detail);

    if (isOpen && selectedStatus && capabilities.showCalls && activeCallId && !selectedCall && selectedDestinationType === 'none' && !hasPreselectedRef.current) {
      // Check if we have calls available (loaded) or should wait
      if (!isLoading && availableCalls.length > 0) {
        const activeCall = availableCalls.find((call) => call.CallId === activeCallId);
        if (activeCall) {
          // Update both states immediately in the same render cycle
          setSelectedDestinationType('call');
          setSelectedCall(activeCall);
          hasPreselectedRef.current = true;
        }
      } else if (isLoading || availableCalls.length === 0) {
        // If still loading, immediately set destination type to 'call' to prevent "No Destination" from showing
        // We'll set the actual call once it loads
        setSelectedDestinationType('call');
        hasPreselectedRef.current = true;
      }
    }

    // Handle case where destination type is already 'call' but call hasn't been set yet
    // This covers the scenario from the removed redundant effect
    if (isOpen && selectedStatus && capabilities.showCalls && activeCallId && !selectedCall && selectedDestinationType === 'call' && !isLoading && availableCalls.length > 0) {
      const activeCall = availableCalls.find((call) => call.CallId === activeCallId);
      if (activeCall) {
        setSelectedCall(activeCall);
      }
    }
  }, [isOpen, isLoading, selectedStatus, activeCallId, availableCalls, selectedCall, selectedDestinationType, setSelectedCall, setSelectedDestinationType]);

  // Smart logic: only show "No Destination" as selected if we truly want no destination
  // Don't show it as selected if we're about to pre-select an active call or already have one selected
  const shouldShowNoDestinationAsSelected = React.useMemo(() => {
    // If something else is already selected, don't show no destination as selected
    if (selectedCall || selectedStation || selectedPoi) {
      return false;
    }

    // If we're in a state where we should pre-select an active call, don't show no destination as selected
    const shouldPreSelectActiveCall = isOpen && selectedStatus && getDestinationCapabilities(selectedStatus.Detail).showCalls && activeCallId && !selectedCall;

    if (shouldPreSelectActiveCall) {
      return false;
    }

    // Otherwise, show it as selected only if explicitly set to 'none'
    return selectedDestinationType === 'none';
  }, [selectedDestinationType, selectedCall, selectedStation, selectedPoi, isOpen, selectedStatus, activeCallId]);

  // Determine step logic
  const detailLevel = getStatusProperty('Detail', 0);
  const destinationCapabilities = getDestinationCapabilities(detailLevel);
  const enabledDestinationTabs = getEnabledDestinationTabs(detailLevel);
  const shouldShowDestinationStep = destinationCapabilities.supportsDestination;
  const noteType = getStatusProperty('Note', 0);
  const isNoteRequired = noteType === 2; // NoteType 2 = required
  const isNoteOptional = noteType === 1; // NoteType 1 = optional
  const shouldShowTabHeaders = enabledDestinationTabs.length > 1;

  const getStatusDetailDescription = (detail: number) => {
    switch (detail) {
      case 1:
        return t('status.station_destination_enabled');
      case 2:
        return t('status.call_destination_enabled');
      case 3:
        return t('status.both_destinations_enabled');
      case 4:
        return t('status.poi_destination_enabled');
      case 5:
        return t('status.calls_and_pois_destination_enabled');
      case 6:
        return t('status.stations_and_pois_destination_enabled');
      case 7:
        return t('status.all_destinations_enabled');
      default:
        return '';
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-status':
        return t('status.select_status');
      case 'select-destination':
        return t('status.select_destination', { status: selectedStatus?.Text });
      case 'add-note':
        return t('status.add_note');
      default:
        return t('status.set_status');
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'select-status':
        return 1;
      case 'select-destination':
        return cameFromStatusSelection ? 2 : 1; // Step 2 if from status selection, step 1 if pre-selected
      case 'add-note':
        if (cameFromStatusSelection) {
          // New flow: step 1 = status, step 2 = destination, step 3 = note
          return shouldShowDestinationStep ? 3 : 2;
        } else {
          // Old flow: step 1 = destination, step 2 = note
          return shouldShowDestinationStep ? 2 : 1;
        }
      default:
        return 1;
    }
  };

  const getTotalSteps = () => {
    if (cameFromStatusSelection) {
      // New flow calculation
      let totalSteps = 1; // Always have status selection

      if (selectedStatus) {
        // We can determine exact steps based on the selected status
        const hasDestinationSelection = getStatusProperty('Detail', 0) > 0;
        const noteType = getStatusProperty('Note', 0);
        const hasNoteStep = noteType > 0; // Show note step for noteType 1 (optional) or 2 (required)

        if (hasDestinationSelection) totalSteps++;
        if (hasNoteStep) totalSteps++;
      } else {
        // Conservative estimate when no status is selected yet
        // Look at available statuses to determine potential steps
        if (availableStatuses.length > 0) {
          const hasAnyDestination = availableStatuses.some((s) => s.Detail > 0);
          const hasAnyNote = availableStatuses.some((s) => s.Note > 0);

          if (hasAnyDestination) totalSteps++;
          if (hasAnyNote) totalSteps++;
        } else {
          // Fallback: assume all steps
          totalSteps = 3;
        }
      }

      return totalSteps;
    } else {
      // Old flow calculation
      const hasDestinationSelection = shouldShowDestinationStep;
      const hasNoteStep = isNoteRequired || isNoteOptional;

      let totalSteps = 0;
      if (hasDestinationSelection) totalSteps++;
      if (hasNoteStep) totalSteps++;

      return Math.max(totalSteps, 1);
    }
  };

  const canProceedFromCurrentStep = () => {
    if (isSubmitting) return false; // Can't proceed while submitting

    switch (currentStep) {
      case 'select-status':
        return !!selectedStatus; // Must have a status selected
      case 'select-destination':
        return true; // Can proceed with any selection including none
      case 'add-note':
        return !isNoteRequired || note.trim().length > 0; // Note required check
      default:
        return false;
    }
  };

  const getSelectedDestinationDisplay = () => {
    // First, check if we have a selected call or station regardless of destination type
    // This handles cases where the destination type might be temporarily incorrect
    if (selectedCall) {
      return `${selectedCall.Number} - ${selectedCall.Name}`;
    }

    if (selectedStation) {
      return selectedStation.Name;
    }

    if (selectedPoi) {
      return getPoiSelectionLabel(selectedPoi);
    }

    // Then check destination type for other scenarios
    if (selectedDestinationType === 'call') {
      if (activeCallId) {
        // Fallback: if we're supposed to have a call selected but selectedCall is null,
        // try to find it in availableCalls
        const activeCall = availableCalls.find((call) => call.CallId === activeCallId);
        if (activeCall) {
          return `${activeCall.Number} - ${activeCall.Name}`;
        } else {
          // Still loading or call not found, show loading state
          return t('calls.loading_calls');
        }
      }
    }

    return t('status.no_destination');
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      {/* The sheet renders inside a native Modal, so keyboard-controller's window-bound
          avoidance never moves it — padding by the keyboard height reserves the covered
          strip instead. shrink on the column lets the step content compress into the
          remaining space so its scrollview actually scrolls rather than Yoga clipping it. */}
      <ActionsheetContent className="bg-white dark:bg-gray-900" style={{ paddingBottom: keyboardHeight }}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full shrink p-4">
          {/* Step indicator */}
          <HStack space="sm" className="mb-2 justify-center">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.step')} {getStepNumber()} {t('common.of')} {getTotalSteps()}
            </Text>
          </HStack>

          <Heading size="lg" className="mb-4 text-center">
            {getStepTitle()}
          </Heading>

          {currentStep === 'select-status' && (
            <VStack space="md" className="w-full">
              <Text className="mb-2 font-medium">{t('status.select_status_type')}</Text>

              <ScrollView className="max-h-[400px]">
                <VStack space="sm">
                  {availableStatuses.length > 0 ? (
                    availableStatuses.map((status) => (
                      <TouchableOpacity
                        key={status.Id}
                        onPress={() => handleStatusSelect(status.Id.toString())}
                        className={`mb-3 rounded-lg border-2 p-3 ${selectedStatus?.Id.toString() === status.Id.toString() ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
                        style={{
                          backgroundColor: status.BColor || (selectedStatus?.Id.toString() === status.Id.toString() ? '#dbeafe' : '#ffffff'),
                        }}
                      >
                        <HStack space="sm" className="items-center">
                          <Check size={20} color={selectedStatus?.Id.toString() === status.Id.toString() ? '#3b82f6' : 'transparent'} />
                          <VStack className="flex-1">
                            <Text className="font-bold" style={{ color: invertColor(status.BColor || '#ffffff', true) }}>
                              {status.Text}
                            </Text>
                            {status.Detail > 0 && <Text className="text-sm text-gray-600 dark:text-gray-400">{getStatusDetailDescription(status.Detail)}</Text>}
                            {status.Note > 0 && (
                              <Text className="text-xs text-gray-500 dark:text-gray-500">
                                {status.Note === 1 && t('status.note_optional')}
                                {status.Note === 2 && t('status.note_required')}
                              </Text>
                            )}
                          </VStack>
                        </HStack>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_statuses_available')}</Text>
                  )}
                </VStack>
              </ScrollView>

              <HStack space="sm" className="mt-2 justify-end px-4">
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600 px-4 py-2">
                  <ButtonText className="text-sm">{t('common.next')}</ButtonText>
                  <ArrowRight size={14} color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                </Button>
              </HStack>
            </VStack>
          )}

          {currentStep === 'select-destination' && shouldShowDestinationStep && (
            <VStack space="md" className="w-full">
              <Text className="mb-2 font-medium">{t('status.select_destination_type')}</Text>

              {/* No Destination Option */}
              <TouchableOpacity
                onPress={handleNoDestinationSelect}
                className={`mb-4 rounded-lg border-2 p-3 ${shouldShowNoDestinationAsSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
              >
                <HStack space="sm" className="items-center">
                  <Check size={20} color={shouldShowNoDestinationAsSelected ? '#3b82f6' : 'transparent'} />
                  <VStack className="flex-1">
                    <Text className="font-bold">{t('status.no_destination')}</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{t('status.general_status')}</Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>

              {enabledDestinationTabs.length > 0 && (
                <>
                  {shouldShowTabHeaders && (
                    <HStack space="xs" className="mb-4">
                      {enabledDestinationTabs.includes('calls') ? (
                        <TouchableOpacity onPress={() => setSelectedTab('calls')} className={`flex-1 rounded-lg py-3 ${selectedTab === 'calls' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <Text className={`text-center font-semibold ${selectedTab === 'calls' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t('status.calls_tab')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {enabledDestinationTabs.includes('stations') ? (
                        <TouchableOpacity onPress={() => setSelectedTab('stations')} className={`flex-1 rounded-lg py-3 ${selectedTab === 'stations' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <Text className={`text-center font-semibold ${selectedTab === 'stations' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t('status.stations_tab')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {enabledDestinationTabs.includes('pois') ? (
                        <TouchableOpacity onPress={() => setSelectedTab('pois')} className={`flex-1 rounded-lg py-3 ${selectedTab === 'pois' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <Text className={`text-center font-semibold ${selectedTab === 'pois' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t('status.pois_tab')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </HStack>
                  )}

                  <ScrollView className={shouldShowTabHeaders ? 'max-h-[200px]' : 'max-h-[300px]'}>
                    {enabledDestinationTabs.includes('calls') && (!shouldShowTabHeaders || selectedTab === 'calls') && (
                      <VStack space="sm">
                        {isLoading ? (
                          <VStack space="md" className="w-full items-center justify-center">
                            <Spinner size="large" />
                            <Text className="text-center text-gray-600 dark:text-gray-400">{t('calls.loading_calls')}</Text>
                          </VStack>
                        ) : availableCalls && availableCalls.length > 0 ? (
                          availableCalls.map((call) => (
                            <TouchableOpacity
                              key={call.CallId}
                              onPress={() => handleCallSelect(call.CallId)}
                              className={`mb-3 rounded-lg border-2 p-3 ${selectedCall?.CallId === call.CallId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                            >
                              <HStack space="sm" className="items-center">
                                <Check size={20} color={selectedCall?.CallId === call.CallId ? '#3b82f6' : 'transparent'} />
                                <VStack className="flex-1">
                                  <Text className="font-bold">
                                    {call.Number} - {call.Name}
                                  </Text>
                                  <Text className="text-sm text-gray-600 dark:text-gray-400">{call.Address}</Text>
                                </VStack>
                              </HStack>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('calls.no_calls_available')}</Text>
                        )}
                      </VStack>
                    )}

                    {enabledDestinationTabs.includes('stations') && (!shouldShowTabHeaders || selectedTab === 'stations') && (
                      <VStack space="sm">
                        {isLoading ? (
                          <VStack space="md" className="w-full items-center justify-center">
                            <Spinner size="large" />
                            <Text className="text-center text-gray-600 dark:text-gray-400">{t('status.loading_stations')}</Text>
                          </VStack>
                        ) : availableStations && availableStations.length > 0 ? (
                          availableStations.map((station) => (
                            <TouchableOpacity
                              key={station.GroupId}
                              onPress={() => handleStationSelect(station.GroupId)}
                              className={`mb-3 rounded-lg border-2 p-3 ${selectedStation?.GroupId === station.GroupId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                            >
                              <HStack space="sm" className="items-center">
                                <Check size={20} color={selectedStation?.GroupId === station.GroupId ? '#3b82f6' : 'transparent'} />
                                <VStack className="flex-1">
                                  <Text className="font-bold">{station.Name}</Text>
                                  {station.Address && <Text className="text-sm text-gray-600 dark:text-gray-400">{station.Address}</Text>}
                                  {station.GroupType && <Text className="text-xs text-gray-500 dark:text-gray-500">{station.GroupType}</Text>}
                                </VStack>
                              </HStack>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_stations_available')}</Text>
                        )}
                      </VStack>
                    )}

                    {enabledDestinationTabs.includes('pois') && (!shouldShowTabHeaders || selectedTab === 'pois') && (
                      <VStack space="sm">
                        {isLoading ? (
                          <VStack space="md" className="w-full items-center justify-center">
                            <Spinner size="large" />
                            <Text className="text-center text-gray-600 dark:text-gray-400">{t('status.loading_pois')}</Text>
                          </VStack>
                        ) : availablePois && availablePois.length > 0 ? (
                          availablePois.map((poi) => (
                            <TouchableOpacity
                              key={poi.PoiId}
                              onPress={() => handlePoiSelect(poi.PoiId)}
                              className={`mb-3 rounded-lg border-2 p-3 ${selectedPoi?.PoiId === poi.PoiId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                            >
                              <HStack space="sm" className="items-center">
                                <Check size={20} color={selectedPoi?.PoiId === poi.PoiId ? '#3b82f6' : 'transparent'} />
                                <VStack className="flex-1">
                                  <Text className="font-bold">{getPoiSelectionLabel(poi)}</Text>
                                  {poi.Note ? <Text className="text-sm text-gray-600 dark:text-gray-400">{poi.Note}</Text> : null}
                                  {poi.PoiTypeName ? <Text className="text-xs text-gray-500 dark:text-gray-500">{poi.PoiTypeName}</Text> : null}
                                </VStack>
                              </HStack>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_pois_available')}</Text>
                        )}
                      </VStack>
                    )}
                  </ScrollView>
                </>
              )}

              <HStack space="sm" className="mt-2 justify-end px-4">
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600 px-4 py-2">
                  <ButtonText className="text-sm">{t('common.next')}</ButtonText>
                  <ArrowRight size={14} color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                </Button>
              </HStack>
            </VStack>
          )}

          {currentStep === 'select-destination' && !shouldShowDestinationStep && (
            // If Detail = 0, skip destination step and show note step directly
            <VStack space="md" className="w-full">
              {isNoteRequired || isNoteOptional ? (
                <>
                  <Text className="mb-2 font-medium">{t('status.add_note')}</Text>
                  <Textarea size="md" className="min-h-[100px] w-full">
                    <TextareaInput placeholder={isNoteRequired ? t('status.note_required') : t('status.note_optional')} value={note} onChangeText={setNote} />
                  </Textarea>
                </>
              ) : null}
              <Button onPress={handleSubmit} className="self-end bg-blue-600 px-4 py-2" isDisabled={(isNoteRequired && !note.trim()) || isSubmitting}>
                {isSubmitting && <Spinner size="small" color="white" />}
                <ButtonText className="text-sm">{isSubmitting ? t('common.submitting') : t('common.submit')}</ButtonText>
              </Button>
            </VStack>
          )}

          {currentStep === 'add-note' && (
            /* Plain ScrollView on purpose: the sheet already slides above the keyboard via
               the ActionsheetContent paddingBottom. KeyboardAwareScrollView also reacts to
               the keyboard (its events are window-agnostic), so it compensated a second
               time and pushed the note field out of the sheet's visible area. */
            <ScrollView keyboardShouldPersistTaps={Platform.OS === 'android' ? 'handled' : 'always'} showsVerticalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1, width: '100%' }}>
              <VStack space="md" className="w-full">
                {/* Selected Status */}
                <VStack space="sm">
                  <Text className="font-medium">{t('status.selected_status')}:</Text>
                  <VStack className="rounded-lg p-2" style={{ backgroundColor: selectedStatus?.BColor || '#f3f4f6' }}>
                    <Text className="font-bold" style={{ color: invertColor(selectedStatus?.BColor || '#f3f4f6', true) }}>
                      {selectedStatus?.Text}
                    </Text>
                  </VStack>
                </VStack>

                {/* Selected Destination */}
                <VStack space="sm">
                  <Text className="font-medium">{t('status.selected_destination')}:</Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">{getSelectedDestinationDisplay()}</Text>
                </VStack>

                <VStack space="sm">
                  <Text className="font-medium">
                    {t('status.note')} {isNoteRequired ? '' : `(${t('common.optional')})`}:
                  </Text>
                  <Textarea size="md" className="min-h-[100px] w-full">
                    <TextareaInput placeholder={isNoteRequired ? t('status.note_required') : t('status.note_optional')} value={note} onChangeText={setNote} />
                  </Textarea>
                </VStack>

                <HStack space="xs" className="justify-between px-2">
                  <Button variant="outline" onPress={handlePrevious} className="px-3" isDisabled={isSubmitting}>
                    <ArrowLeft size={14} color={colorScheme === 'dark' ? '#737373' : '#737373'} />
                    <ButtonText className="text-sm">{t('common.previous')}</ButtonText>
                  </Button>
                  <Button onPress={handleSubmit} isDisabled={!canProceedFromCurrentStep() || isSubmitting} className="bg-blue-600 px-3">
                    {isSubmitting && <Spinner size="small" color="white" />}
                    <ButtonText className="text-sm">{isSubmitting ? t('common.submitting') : t('common.submit')}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </ScrollView>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
