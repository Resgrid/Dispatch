import { useFocusEffect } from '@react-navigation/native';
import { type Href, router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { getCallNotes, saveCallNote } from '@/api/calls/callNotes';
import { getCallExtraData } from '@/api/calls/calls';
import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { AudioStreamBottomSheet } from '@/components/audio-stream/audio-stream-bottom-sheet';
import { CloseCallBottomSheet } from '@/components/calls/close-call-bottom-sheet';
import {
  ActiveCallFilterBanner,
  ActiveCallsPanel,
  ActivityLogPanel,
  AddNoteBottomSheet,
  MapWidget,
  NotesPanel,
  PersonnelPanel,
  PTTInterface,
  ResourcesPanel,
  StatsHeader,
  UnitsPanel,
} from '@/components/dispatch-console';
import { Box } from '@/components/ui/box';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { logger } from '@/lib/logging';
import { isCallActive, isCallPending, isCallScheduled } from '@/lib/utils';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { WeatherAlertSeverity } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import useAuthStore from '@/stores/auth/store';
import { useCallsStore } from '@/stores/calls/store';
import { useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useHomeStore } from '@/stores/home/home-store';
import { useNotesStore } from '@/stores/notes/store';
import { usePersonnelStore } from '@/stores/personnel/store';
import { type SignalREventType, useSignalRStore } from '@/stores/signalr/signalr-store';
import { useToastStore } from '@/stores/toast/store';
import { useUnitsStore } from '@/stores/units/store';
import { useWeatherAlertsStore } from '@/stores/weatherAlerts/store';

export default function DispatchConsoleWeb() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;

  // Store hooks
  const refreshAll = useHomeStore((s) => s.refreshAll);
  const userId = useAuthStore((s) => s.userId);
  const calls = useCallsStore((s) => s.calls);
  const callPriorities = useCallsStore((s) => s.callPriorities);
  const callsLoading = useCallsStore((s) => s.isLoading);
  const fetchCalls = useCallsStore((s) => s.fetchCalls);
  const fetchCallPriorities = useCallsStore((s) => s.fetchCallPriorities);
  const units = useUnitsStore((s) => s.units);
  const unitsLoading = useUnitsStore((s) => s.isLoading);
  const fetchUnits = useUnitsStore((s) => s.fetchUnits);
  const personnel = usePersonnelStore((s) => s.personnel);
  const personnelLoading = usePersonnelStore((s) => s.isLoading);
  const fetchPersonnel = usePersonnelStore((s) => s.fetchPersonnel);
  const singleList = useDashboardViewStore((s) => s.singleList);
  const notes = useNotesStore((s) => s.notes);
  const notesLoading = useNotesStore((s) => s.isLoading);
  const fetchNotes = useNotesStore((s) => s.fetchNotes);

  // SignalR store - subscribe to specific event timestamps
  const lastEventType = useSignalRStore((s) => s.lastEventType);
  const lastPersonnelUpdateTimestamp = useSignalRStore((s) => s.lastPersonnelUpdateTimestamp);
  const lastUnitsUpdateTimestamp = useSignalRStore((s) => s.lastUnitsUpdateTimestamp);
  const lastCallsUpdateTimestamp = useSignalRStore((s) => s.lastCallsUpdateTimestamp);
  const isUpdateHubConnected = useSignalRStore((s) => s.isUpdateHubConnected);

  // Weather alerts
  const weatherAlerts = useWeatherAlertsStore((s) => s.alerts);
  const weatherSettings = useWeatherAlertsStore((s) => s.settings);
  const fetchWeatherAlerts = useWeatherAlertsStore((s) => s.fetchActiveAlerts);
  const showToast = useToastStore((s) => s.showToast);

  // Extreme/Severe counts for the stats bar
  const extremeAlertCount = useMemo(() => weatherAlerts.filter((a) => a.Severity === WeatherAlertSeverity.Extreme).length, [weatherAlerts]);
  const severeAlertCount = useMemo(() => weatherAlerts.filter((a) => a.Severity === WeatherAlertSeverity.Severe).length, [weatherAlerts]);

  // Show active weather alerts as an auto-dismissing toast (tap to open the alerts list).
  // Deduped by a signature of the top alert + count so re-renders don't spam toasts.
  const weatherAlertToastSignature = useRef('');
  useEffect(() => {
    if (weatherSettings?.WeatherAlertsEnabled === false) return;
    if (weatherAlerts.length === 0) {
      weatherAlertToastSignature.current = '';
      return;
    }
    const signature = `${weatherAlerts[0].WeatherAlertId}-${weatherAlerts.length}`;
    if (signature === weatherAlertToastSignature.current) return;
    weatherAlertToastSignature.current = signature;
    const topAlert = weatherAlerts[0];
    const more = weatherAlerts.length > 1 ? ` ${t('weatherAlerts.moreAlerts', { count: weatherAlerts.length - 1 })}` : '';
    showToast('warning', `${topAlert.Event}${more}`, 'weatherAlerts.title', {
      duration: 6000,
      onPress: () => router.push('/(app)/weather-alerts' as Href),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherAlerts, weatherSettings]);

  // Dispatch console store
  const selectedCallId = useDispatchConsoleStore((s) => s.selectedCallId);
  const selectedUnitId = useDispatchConsoleStore((s) => s.selectedUnitId);
  const selectedPersonnelId = useDispatchConsoleStore((s) => s.selectedPersonnelId);
  const activityLog = useDispatchConsoleStore((s) => s.activityLog);
  const radioLog = useDispatchConsoleStore((s) => s.radioLog);
  const isTransmitting = useDispatchConsoleStore((s) => s.isTransmitting);
  const currentChannel = useDispatchConsoleStore((s) => s.currentChannel);
  const isCallFilterActive = useDispatchConsoleStore((s) => s.isCallFilterActive);
  const selectedCallExtraData = useDispatchConsoleStore((s) => s.selectedCallExtraData);
  const selectedCallNotes = useDispatchConsoleStore((s) => s.selectedCallNotes);
  const isLoadingCallData = useDispatchConsoleStore((s) => s.isLoadingCallData);
  const mapCenterLatitude = useDispatchConsoleStore((s) => s.mapCenterLatitude);
  const mapCenterLongitude = useDispatchConsoleStore((s) => s.mapCenterLongitude);
  const setSelectedCallId = useDispatchConsoleStore((s) => s.setSelectedCallId);
  const setSelectedUnitId = useDispatchConsoleStore((s) => s.setSelectedUnitId);
  const setSelectedPersonnelId = useDispatchConsoleStore((s) => s.setSelectedPersonnelId);
  const addActivityLogEntry = useDispatchConsoleStore((s) => s.addActivityLogEntry);
  const setIsTransmitting = useDispatchConsoleStore((s) => s.setIsTransmitting);
  const toggleCallFilter = useDispatchConsoleStore((s) => s.toggleCallFilter);
  const clearCallFilter = useDispatchConsoleStore((s) => s.clearCallFilter);
  const setCallExtraData = useDispatchConsoleStore((s) => s.setCallExtraData);
  const setCallNotes = useDispatchConsoleStore((s) => s.setCallNotes);
  const setIsLoadingCallData = useDispatchConsoleStore((s) => s.setIsLoadingCallData);
  const setMapCenter = useDispatchConsoleStore((s) => s.setMapCenter);

  // Local state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddNoteSheetOpen, setIsAddNoteSheetOpen] = useState(false);
  const [selectedPersonnelData, setSelectedPersonnelData] = useState<PersonnelInfoResultData | null>(null);
  const [selectedUnitData, setSelectedUnitData] = useState<UnitInfoResultData | null>(null);
  const [isCloseCallSheetOpen, setIsCloseCallSheetOpen] = useState(false);

  // Track previous timestamps to detect changes
  const prevPersonnelTimestamp = useRef(0);
  const prevUnitsTimestamp = useRef(0);
  const prevCallsTimestamp = useRef(0);

  // Initialize data when component mounts
  useEffect(() => {
    refreshAll();
    fetchCalls();
    fetchCallPriorities();
    fetchUnits();
    fetchPersonnel();
    fetchNotes();
    fetchMapCenter();
    fetchWeatherAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch map center coordinates for weather
  const fetchMapCenter = async () => {
    try {
      const mapData = await getMapDataAndMarkers();
      if (mapData?.Data?.CenterLat && mapData?.Data?.CenterLon) {
        const lat = parseFloat(mapData.Data.CenterLat);
        const lon = parseFloat(mapData.Data.CenterLon);
        if (!isNaN(lat) && !isNaN(lon)) {
          setMapCenter(lat, lon);
        }
      }
    } catch (error) {
      logger.error({
        message: 'Failed to fetch map center for weather',
        context: { error },
      });
    }
  };

  // Refresh data and track analytics when view becomes visible
  useFocusEffect(
    useCallback(() => {
      trackEvent('dispatch_console_viewed', {
        timestamp: new Date().toISOString(),
        isLandscape,
        isTablet,
        platform: 'web',
      });
      // Re-fetch core data so downstream panels (including check-in timers) refresh
      fetchCalls();
      fetchUnits();
      fetchPersonnel();
    }, [trackEvent, isLandscape, isTablet, fetchCalls, fetchUnits, fetchPersonnel])
  );

  // Helper function to get event description for activity log
  const getEventDescription = (eventType: SignalREventType | null): string => {
    switch (eventType) {
      case 'personnelStatusUpdated':
        return t('dispatch.personnel_status_updated');
      case 'personnelStaffingUpdated':
        return t('dispatch.personnel_staffing_updated');
      case 'unitStatusUpdated':
        return t('dispatch.unit_status_updated');
      case 'callsUpdated':
        return t('dispatch.calls_updated');
      case 'callAdded':
        return t('dispatch.call_added');
      case 'callClosed':
        return t('dispatch.call_closed');
      default:
        return t('dispatch.data_refreshed');
    }
  };

  // Listen for SignalR personnel updates
  useEffect(() => {
    if (lastPersonnelUpdateTimestamp > 0 && lastPersonnelUpdateTimestamp !== prevPersonnelTimestamp.current) {
      prevPersonnelTimestamp.current = lastPersonnelUpdateTimestamp;

      logger.info({
        message: 'SignalR: Personnel update received, refreshing personnel data',
        context: { eventType: lastEventType, timestamp: lastPersonnelUpdateTimestamp },
      });

      addActivityLogEntry({
        type: 'personnel',
        action: t('dispatch.signalr_update'),
        description: getEventDescription(lastEventType),
      });

      fetchPersonnel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPersonnelUpdateTimestamp]);

  // Listen for SignalR units updates
  useEffect(() => {
    if (lastUnitsUpdateTimestamp > 0 && lastUnitsUpdateTimestamp !== prevUnitsTimestamp.current) {
      prevUnitsTimestamp.current = lastUnitsUpdateTimestamp;

      logger.info({
        message: 'SignalR: Units update received, refreshing units data',
        context: { eventType: lastEventType, timestamp: lastUnitsUpdateTimestamp },
      });

      addActivityLogEntry({
        type: 'unit',
        action: t('dispatch.signalr_update'),
        description: getEventDescription(lastEventType),
      });

      fetchUnits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUnitsUpdateTimestamp]);

  // Listen for SignalR calls updates
  useEffect(() => {
    if (lastCallsUpdateTimestamp > 0 && lastCallsUpdateTimestamp !== prevCallsTimestamp.current) {
      prevCallsTimestamp.current = lastCallsUpdateTimestamp;

      logger.info({
        message: 'SignalR: Calls update received, refreshing calls data',
        context: { eventType: lastEventType, timestamp: lastCallsUpdateTimestamp },
      });

      addActivityLogEntry({
        type: 'call',
        action: t('dispatch.signalr_update'),
        description: getEventDescription(lastEventType),
      });

      fetchCalls();
      // Also refresh notes if we have a selected call (call data may have changed)
      if (selectedCallId) {
        fetchNotes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCallsUpdateTimestamp]);

  // Log when SignalR hub connection status changes
  useEffect(() => {
    if (isUpdateHubConnected) {
      logger.info({
        message: 'SignalR Update Hub connected - dispatch console ready for real-time updates',
      });
      addActivityLogEntry({
        type: 'system',
        action: t('dispatch.signalr_connected'),
        description: t('dispatch.realtime_updates_active'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpdateHubConnected]);

  // Fetch call extra data and notes when filter is active
  useEffect(() => {
    const fetchCallData = async () => {
      if (isCallFilterActive && selectedCallId) {
        setIsLoadingCallData(true);
        try {
          const [extraDataResponse, notesResponse] = await Promise.all([getCallExtraData(selectedCallId), getCallNotes(selectedCallId)]);

          if (extraDataResponse.Data) {
            setCallExtraData(extraDataResponse.Data);
          }
          if (notesResponse.Data) {
            setCallNotes(notesResponse.Data);
          }
        } catch (error) {
          console.error('Error fetching call data:', error);
        } finally {
          setIsLoadingCallData(false);
        }
      }
    };

    fetchCallData();
  }, [isCallFilterActive, selectedCallId, setIsLoadingCallData, setCallExtraData, setCallNotes]);

  // Memoized selected call
  const selectedCall = useMemo(() => {
    return calls.find((c) => c.CallId === selectedCallId);
  }, [calls, selectedCallId]);

  // Memoized selected call priority
  const selectedCallPriority = useMemo(() => {
    if (!selectedCall) return undefined;
    return callPriorities.find((p) => p.Id === selectedCall.Priority);
  }, [selectedCall, callPriorities]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCalls = calls.filter((c) => isCallActive(c.State)).length;
    const pendingCalls = calls.filter((c) => isCallPending(c.State)).length;
    const scheduledCalls = calls.filter((c) => isCallScheduled(c.State)).length;
    // Only count units/personnel with explicit 'available' or 'standing by' status (case-insensitive)
    // Missing or null statuses are NOT considered available for safety in dispatch scenarios
    const availableUnits = units.filter((u) => {
      const status = (u.CurrentStatus || '').toLowerCase();
      return status === 'available' || status === 'standing by';
    }).length;
    // Personnel with Available or Standing By status
    const availablePersonnel = personnel.filter((p) => {
      const status = (p.Status || '').toLowerCase();
      return status === 'available' || status === 'standing by';
    }).length;
    const onDutyPersonnel = personnel.filter((p) => {
      const staffing = (p.Staffing || '').toLowerCase();
      return staffing && staffing !== 'off duty' && staffing !== 'unavailable';
    }).length;

    return {
      activeCalls,
      pendingCalls,
      scheduledCalls,
      unitsAvailable: availableUnits,
      personnelAvailable: availablePersonnel,
      personnelOnDuty: onDutyPersonnel,
    };
  }, [calls, units, personnel]);

  // Handle PTT
  const handlePTTPress = useCallback(() => {
    setIsTransmitting(true);
    addActivityLogEntry({
      type: 'system',
      action: t('dispatch.ptt_start'),
      description: t('dispatch.transmitting_on', { channel: currentChannel }),
    });
  }, [setIsTransmitting, addActivityLogEntry, t, currentChannel]);

  const handlePTTRelease = useCallback(() => {
    setIsTransmitting(false);
    addActivityLogEntry({
      type: 'system',
      action: t('dispatch.ptt_end'),
      description: t('dispatch.transmission_ended'),
    });
  }, [setIsTransmitting, addActivityLogEntry, t]);

  // Handle call selection - now toggles filter mode
  const handleSelectCall = useCallback(
    (callId: string) => {
      toggleCallFilter(callId);
      const call = calls.find((c) => c.CallId === callId);
      if (call) {
        addActivityLogEntry({
          type: 'call',
          action: isCallFilterActive && selectedCallId === callId ? t('dispatch.call_filter_cleared') : t('dispatch.call_filter_active'),
          description: `#${call.Number} - ${call.Name || call.Nature}`,
          metadata: { callId },
        });
      }
    },
    [toggleCallFilter, calls, addActivityLogEntry, t, isCallFilterActive, selectedCallId]
  );

  // Handle unit selection - toggle if already selected
  const handleSelectUnit = useCallback(
    (unitId: string, unit?: UnitInfoResultData) => {
      const isAlreadySelected = selectedUnitId === unitId;
      setSelectedUnitId(isAlreadySelected ? null : unitId);
      // Find unit from array if not passed directly
      const unitData = unit ?? units.find((u) => u.UnitId === unitId);
      setSelectedUnitData(isAlreadySelected ? null : (unitData ?? null));
      // Clear personnel selection when selecting a unit
      if (!isAlreadySelected) {
        setSelectedPersonnelId(null);
        setSelectedPersonnelData(null);
      }
      const unitToLog = unitData;
      if (unitToLog) {
        addActivityLogEntry({
          type: 'unit',
          action: isAlreadySelected ? t('dispatch.unit_deselected') : t('dispatch.unit_selected'),
          description: unitToLog.Name,
          metadata: { unitId },
        });
      }
    },
    [selectedUnitId, setSelectedUnitId, units, setSelectedPersonnelId, addActivityLogEntry, t]
  );

  // Handle personnel selection - toggle if already selected
  const handleSelectPersonnel = useCallback(
    (personnelId: string, person?: PersonnelInfoResultData) => {
      const isAlreadySelected = selectedPersonnelId === personnelId;
      setSelectedPersonnelId(isAlreadySelected ? null : personnelId);
      setSelectedPersonnelData(isAlreadySelected ? null : (person ?? null));
      // Clear unit selection when selecting personnel
      if (!isAlreadySelected) {
        setSelectedUnitId(null);
        setSelectedUnitData(null);
      }
      if (person) {
        addActivityLogEntry({
          type: 'personnel',
          action: isAlreadySelected ? t('dispatch.personnel_deselected') : t('dispatch.personnel_selected'),
          description: `${person.FirstName} ${person.LastName}`,
          metadata: { personnelId },
        });
      }
    },
    [selectedPersonnelId, setSelectedPersonnelId, setSelectedUnitId, addActivityLogEntry, t]
  );

  // Handle status/staffing update completion - refresh personnel list
  const handleStatusUpdated = useCallback(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  const handleStaffingUpdated = useCallback(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  // Handle unit status update completion - refresh units list
  const handleUnitStatusUpdated = useCallback(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Handle expanding map
  const handleExpandMap = useCallback(() => {
    router.push('/(app)/map' as Href);
  }, []);

  // Handle clearing call filter
  const handleClearCallFilter = useCallback(() => {
    clearCallFilter();
    addActivityLogEntry({
      type: 'system',
      action: t('dispatch.call_filter_cleared'),
      description: t('dispatch.showing_all_data'),
    });
  }, [clearCallFilter, addActivityLogEntry, t]);

  // Handle adding call note
  const handleAddCallNote = useCallback(
    async (note: string) => {
      if (!selectedCallId || !note.trim() || !userId) return;

      setIsAddingNote(true);
      try {
        await saveCallNote(selectedCallId, userId, note, null, null);

        // Refresh call notes
        const notesResponse = await getCallNotes(selectedCallId);
        if (notesResponse.Data) {
          setCallNotes(notesResponse.Data);
        }

        addActivityLogEntry({
          type: 'call',
          action: t('dispatch.note_added'),
          description: note.substring(0, 50) + (note.length > 50 ? '...' : ''),
          metadata: { callId: selectedCallId },
        });
      } catch (error) {
        console.error('Error adding call note:', error);
      } finally {
        setIsAddingNote(false);
      }
    },
    [selectedCallId, userId, setCallNotes, addActivityLogEntry, t]
  );

  // Handle opening add note sheet
  const handleOpenAddNoteSheet = useCallback(() => {
    setIsAddNoteSheetOpen(true);
  }, []);

  // Handle note added from bottom sheet
  const handleNoteAdded = useCallback(() => {
    fetchNotes();
    addActivityLogEntry({
      type: 'system',
      action: t('dispatch.note_created'),
      description: t('dispatch.note_added'),
    });
  }, [fetchNotes, addActivityLogEntry, t]);

  // Call action handlers for the actions panel
  const handleCreateCall = useCallback(() => {
    router.push('/call/new' as Href);
  }, []);

  const handleViewCallDetails = useCallback(() => {
    if (selectedCallId) {
      router.push(`/call/${selectedCallId}` as Href);
    }
  }, [selectedCallId]);

  const handleCloseCallAction = useCallback(() => {
    if (selectedCallId) {
      setIsCloseCallSheetOpen(true);
    }
  }, [selectedCallId]);

  const handleAddCallNoteAction = useCallback(() => {
    if (selectedCallId) {
      setIsAddNoteSheetOpen(true);
    }
  }, [selectedCallId]);

  // Handle setting unit status for call
  const handleSetUnitStatusForCall = useCallback(
    (unitId: string) => {
      const unit = units.find((u) => u.UnitId === unitId);
      if (unit) {
        addActivityLogEntry({
          type: 'unit',
          action: t('dispatch.unit_status_change'),
          description: `${unit.Name}`,
          metadata: { unitId, callId: selectedCallId ?? undefined },
        });
        // TODO: Implement status change modal or action
      }
    },
    [units, addActivityLogEntry, t, selectedCallId]
  );

  // Handle setting personnel status for call
  const handleSetPersonnelStatusForCall = useCallback(
    (personnelId: string) => {
      const person = personnel.find((p) => p.UserId === personnelId);
      if (person) {
        addActivityLogEntry({
          type: 'personnel',
          action: t('dispatch.personnel_status_change'),
          description: `${person.FirstName} ${person.LastName}`,
          metadata: { personnelId, callId: selectedCallId ?? undefined },
        });
        // TODO: Implement status change modal or action
      }
    },
    [personnel, addActivityLogEntry, t, selectedCallId]
  );

  const handleWeatherAlertsPress = useCallback(() => {
    router.push('/(app)/weather-alerts' as Href);
  }, []);

  const handleCloseAddNoteSheet = useCallback(() => {
    setIsAddNoteSheetOpen(false);
  }, []);

  const handleCloseCallSheetClose = useCallback(() => {
    setIsCloseCallSheetOpen(false);
  }, []);

  // Determine layout based on screen size and orientation
  const renderLayout = () => {
    // Desktop/Tablet landscape + single list - 3-column layout with combined resources
    if (isTablet && isLandscape && singleList) {
      return (
        <HStack className="flex-1" space="sm">
          {/* Left Column - Calls & Notes */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <ActiveCallsPanel selectedCallId={selectedCallId ?? undefined} onSelectCall={handleSelectCall} isFilterActive={isCallFilterActive} flexWeight={2} />
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
              flexWeight={1}
            />
          </VStack>

          {/* Center Column - Map */}
          <VStack className="flex-[1.5]" space="sm" style={styles.column}>
            <MapWidget onExpandMap={handleExpandMap} />
            <ActivityLogPanel
              debugId="web-tablet-landscape-single"
              entries={activityLog}
              isLoading={false}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callActivity={selectedCallExtraData?.Activity}
              radioLog={radioLog}
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              selectedPersonnel={selectedPersonnelData}
              selectedUnit={selectedUnitData}
              onStatusUpdated={handleStatusUpdated}
              onStaffingUpdated={handleStaffingUpdated}
              onUnitStatusUpdated={handleUnitStatusUpdated}
              onCreateCall={handleCreateCall}
              onViewCallDetails={handleViewCallDetails}
              onCloseCall={handleCloseCallAction}
              onAddCallNote={handleAddCallNoteAction}
            />
          </VStack>

          {/* Right Column - Resources & PTT */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <ResourcesPanel
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectUnit={handleSelectUnit}
              onSelectPersonnel={handleSelectPersonnel}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetUnitStatusForCall={handleSetUnitStatusForCall}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
            <PTTInterface onPTTPress={handlePTTPress} onPTTRelease={handlePTTRelease} isTransmitting={isTransmitting} currentChannel={currentChannel} />
          </VStack>
        </HStack>
      );
    }

    // Desktop/Tablet landscape - 3-column layout
    if (isTablet && isLandscape) {
      return (
        <HStack className="flex-1" space="sm">
          {/* Left Column - Calls & Units */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <ActiveCallsPanel selectedCallId={selectedCallId ?? undefined} onSelectCall={handleSelectCall} isFilterActive={isCallFilterActive} />
            <UnitsPanel
              units={units}
              isLoading={unitsLoading}
              onRefresh={fetchUnits}
              selectedUnitId={selectedUnitId ?? undefined}
              onSelectUnit={handleSelectUnit}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetUnitStatusForCall={handleSetUnitStatusForCall}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectPersonnel={handleSelectPersonnel}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
          </VStack>

          {/* Center Column - Map */}
          <VStack className="flex-[1.5]" space="sm" style={styles.column}>
            <MapWidget onExpandMap={handleExpandMap} />
            <ActivityLogPanel
              debugId="web-tablet-landscape"
              entries={activityLog}
              isLoading={false}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callActivity={selectedCallExtraData?.Activity}
              radioLog={radioLog}
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              selectedPersonnel={selectedPersonnelData}
              selectedUnit={selectedUnitData}
              onStatusUpdated={handleStatusUpdated}
              onStaffingUpdated={handleStaffingUpdated}
              onUnitStatusUpdated={handleUnitStatusUpdated}
              onCreateCall={handleCreateCall}
              onViewCallDetails={handleViewCallDetails}
              onCloseCall={handleCloseCallAction}
              onAddCallNote={handleAddCallNoteAction}
            />
          </VStack>

          {/* Right Column - Personnel, Notes, PTT */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <PersonnelPanel
              personnel={personnel}
              isLoading={personnelLoading}
              onRefresh={fetchPersonnel}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectPersonnel={handleSelectPersonnel}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
            />
            <PTTInterface onPTTPress={handlePTTPress} onPTTRelease={handlePTTRelease} isTransmitting={isTransmitting} currentChannel={currentChannel} />
          </VStack>
        </HStack>
      );
    }

    // Tablet portrait + single list - 2-column layout with combined resources
    if (isTablet && singleList) {
      return (
        <HStack className="flex-1" space="sm">
          {/* Left Column - Calls & Notes */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <ActiveCallsPanel selectedCallId={selectedCallId ?? undefined} onSelectCall={handleSelectCall} isFilterActive={isCallFilterActive} flexWeight={2} />
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
              flexWeight={1}
            />
          </VStack>

          {/* Right Column */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <MapWidget onExpandMap={handleExpandMap} />
            <ResourcesPanel
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectUnit={handleSelectUnit}
              onSelectPersonnel={handleSelectPersonnel}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetUnitStatusForCall={handleSetUnitStatusForCall}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
            <PTTInterface onPTTPress={handlePTTPress} onPTTRelease={handlePTTRelease} isTransmitting={isTransmitting} currentChannel={currentChannel} />
            <ActivityLogPanel
              debugId="web-tablet-portrait-single"
              entries={activityLog}
              isLoading={false}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callActivity={selectedCallExtraData?.Activity}
              radioLog={radioLog}
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              selectedPersonnel={selectedPersonnelData}
              selectedUnit={selectedUnitData}
              onStatusUpdated={handleStatusUpdated}
              onStaffingUpdated={handleStaffingUpdated}
              onUnitStatusUpdated={handleUnitStatusUpdated}
              onCreateCall={handleCreateCall}
              onViewCallDetails={handleViewCallDetails}
              onCloseCall={handleCloseCallAction}
              onAddCallNote={handleAddCallNoteAction}
            />
          </VStack>
        </HStack>
      );
    }

    // Tablet portrait - 2-column layout
    if (isTablet) {
      return (
        <HStack className="flex-1" space="sm">
          {/* Left Column */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <ActiveCallsPanel selectedCallId={selectedCallId ?? undefined} onSelectCall={handleSelectCall} isFilterActive={isCallFilterActive} />
            <UnitsPanel
              units={units}
              isLoading={unitsLoading}
              onRefresh={fetchUnits}
              selectedUnitId={selectedUnitId ?? undefined}
              onSelectUnit={handleSelectUnit}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetUnitStatusForCall={handleSetUnitStatusForCall}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectPersonnel={handleSelectPersonnel}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
            <PersonnelPanel
              personnel={personnel}
              isLoading={personnelLoading}
              onRefresh={fetchPersonnel}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              onSelectPersonnel={handleSelectPersonnel}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callDispatches={selectedCallExtraData?.Dispatches}
              onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
            />
          </VStack>

          {/* Right Column */}
          <VStack className="flex-1" space="sm" style={styles.column}>
            <MapWidget onExpandMap={handleExpandMap} />
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
            />
            <PTTInterface onPTTPress={handlePTTPress} onPTTRelease={handlePTTRelease} isTransmitting={isTransmitting} currentChannel={currentChannel} />
            <ActivityLogPanel
              debugId="web-tablet-portrait"
              entries={activityLog}
              isLoading={false}
              isCallFilterActive={isCallFilterActive}
              selectedCallId={selectedCallId ?? undefined}
              callActivity={selectedCallExtraData?.Activity}
              radioLog={radioLog}
              selectedUnitId={selectedUnitId ?? undefined}
              selectedPersonnelId={selectedPersonnelId ?? undefined}
              selectedPersonnel={selectedPersonnelData}
              selectedUnit={selectedUnitData}
              onStatusUpdated={handleStatusUpdated}
              onStaffingUpdated={handleStaffingUpdated}
              onUnitStatusUpdated={handleUnitStatusUpdated}
              onCreateCall={handleCreateCall}
              onViewCallDetails={handleViewCallDetails}
              onCloseCall={handleCloseCallAction}
              onAddCallNote={handleAddCallNoteAction}
            />
          </VStack>
        </HStack>
      );
    }

    // Phone - single column scrollable layout
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <VStack space="sm">
          <ActiveCallsPanel selectedCallId={selectedCallId ?? undefined} onSelectCall={handleSelectCall} isFilterActive={isCallFilterActive} />

          {singleList ? (
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
            />
          ) : null}

          <MapWidget onExpandMap={handleExpandMap} />

          {singleList ? (
            <Box style={styles.resourcesPanelBounded}>
              <ResourcesPanel
                selectedUnitId={selectedUnitId ?? undefined}
                selectedPersonnelId={selectedPersonnelId ?? undefined}
                onSelectUnit={handleSelectUnit}
                onSelectPersonnel={handleSelectPersonnel}
                isCallFilterActive={isCallFilterActive}
                selectedCallId={selectedCallId ?? undefined}
                callDispatches={selectedCallExtraData?.Dispatches}
                onSetUnitStatusForCall={handleSetUnitStatusForCall}
                onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
              />
            </Box>
          ) : (
            <HStack space="sm">
              <Box className="flex-1">
                <UnitsPanel
                  units={units}
                  isLoading={unitsLoading}
                  onRefresh={fetchUnits}
                  selectedUnitId={selectedUnitId ?? undefined}
                  onSelectUnit={handleSelectUnit}
                  isCallFilterActive={isCallFilterActive}
                  selectedCallId={selectedCallId ?? undefined}
                  callDispatches={selectedCallExtraData?.Dispatches}
                  onSetUnitStatusForCall={handleSetUnitStatusForCall}
                  selectedPersonnelId={selectedPersonnelId ?? undefined}
                  onSelectPersonnel={handleSelectPersonnel}
                  onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
                />
              </Box>
              <Box className="flex-1">
                <PersonnelPanel
                  personnel={personnel}
                  isLoading={personnelLoading}
                  onRefresh={fetchPersonnel}
                  selectedPersonnelId={selectedPersonnelId ?? undefined}
                  onSelectPersonnel={handleSelectPersonnel}
                  isCallFilterActive={isCallFilterActive}
                  selectedCallId={selectedCallId ?? undefined}
                  callDispatches={selectedCallExtraData?.Dispatches}
                  onSetPersonnelStatusForCall={handleSetPersonnelStatusForCall}
                />
              </Box>
            </HStack>
          )}

          <PTTInterface onPTTPress={handlePTTPress} onPTTRelease={handlePTTRelease} isTransmitting={isTransmitting} currentChannel={currentChannel} />

          {!singleList ? (
            <NotesPanel
              notes={notes}
              isLoading={notesLoading || isLoadingCallData}
              onRefresh={fetchNotes}
              isCallFilterActive={isCallFilterActive}
              callNotes={selectedCallNotes}
              onAddCallNote={handleAddCallNote}
              isAddingNote={isAddingNote}
              onNewNote={handleOpenAddNoteSheet}
            />
          ) : null}

          <ActivityLogPanel
            debugId="web-phone"
            entries={activityLog}
            isLoading={false}
            isCallFilterActive={isCallFilterActive}
            selectedCallId={selectedCallId ?? undefined}
            callActivity={selectedCallExtraData?.Activity}
            radioLog={radioLog}
            selectedUnitId={selectedUnitId ?? undefined}
            selectedPersonnelId={selectedPersonnelId ?? undefined}
            selectedPersonnel={selectedPersonnelData}
            selectedUnit={selectedUnitData}
            onStatusUpdated={handleStatusUpdated}
            onStaffingUpdated={handleStaffingUpdated}
            onUnitStatusUpdated={handleUnitStatusUpdated}
            onCreateCall={handleCreateCall}
            onViewCallDetails={handleViewCallDetails}
            onCloseCall={handleCloseCallAction}
            onAddCallNote={handleAddCallNoteAction}
          />
        </VStack>
      </ScrollView>
    );
  };

  const containerStyle = colorScheme === 'dark' ? [styles.container, styles.containerDark] : [styles.container, styles.containerLight];

  return (
    <View style={StyleSheet.flatten(containerStyle)} testID="dispatch-console-container">
      <FocusAwareStatusBar />

      {/* Stats Header */}
      <StatsHeader
        activeCalls={stats.activeCalls}
        pendingCalls={stats.pendingCalls}
        scheduledCalls={stats.scheduledCalls}
        unitsAvailable={stats.unitsAvailable}
        personnelAvailable={stats.personnelAvailable}
        personnelOnDuty={stats.personnelOnDuty}
        weatherLatitude={mapCenterLatitude}
        weatherLongitude={mapCenterLongitude}
        extremeAlerts={extremeAlertCount}
        severeAlerts={severeAlertCount}
        onWeatherAlertsPress={handleWeatherAlertsPress}
      />

      {/* Active Call Filter Banner */}
      {isCallFilterActive && selectedCall && <ActiveCallFilterBanner call={selectedCall} priority={selectedCallPriority} onClearFilter={handleClearCallFilter} />}

      {/* Main Content */}
      <Box className="flex-1 bg-gray-100 p-2 dark:bg-gray-950">{renderLayout()}</Box>

      {/* Audio Stream Bottom Sheet */}
      <AudioStreamBottomSheet />

      {/* Add Note Bottom Sheet */}
      <AddNoteBottomSheet isOpen={isAddNoteSheetOpen} onClose={handleCloseAddNoteSheet} onNoteAdded={handleNoteAdded} />

      {/* Close Call Bottom Sheet */}
      {selectedCallId && <CloseCallBottomSheet key={selectedCallId} isOpen={isCloseCallSheetOpen} onClose={handleCloseCallSheetClose} callId={selectedCallId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#030712',
  },
  column: {
    minWidth: 0,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  resourcesPanelBounded: {
    maxHeight: 400,
  },
});
