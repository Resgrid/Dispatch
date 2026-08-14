import DOMPurify from 'dompurify';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ClockIcon,
  EditIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LoaderIcon,
  MapPinIcon,
  NavigationIcon,
  NetworkIcon,
  PaperclipIcon,
  RouteIcon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  VideoIcon,
  Volume2Icon,
  XCircleIcon,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { VideoFeedsTab } from '@/components/callVideoFeeds/video-feeds-tab';
import { CheckInTab } from '@/components/checkIn/check-in-tab';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { IncidentCommandTab } from '@/components/incident-command/incident-command-tab';
import StaticMap from '@/components/maps/static-map';
import { AlarmLevelBadge } from '@/components/runcards/alarm-level-badge';
import { EscalateAlarmButton } from '@/components/runcards/escalate-alarm-button';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { buildAddResourcesUpdateRequest, EMPTY_DISPATCH_SELECTION } from '@/lib/dispatch-helpers';
import { logger } from '@/lib/logging';
import { openMapsWithDirections } from '@/lib/navigation';
import { formatDateForDisplay, isCallActive, parseDateISOString } from '@/lib/utils';
import { CheckInTimerStatus } from '@/models/v4/checkIn/checkInEnums';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { useCheckInStore } from '@/stores/checkIn/store';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useSecurityStore } from '@/stores/security/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

import CallAudioModal from '../../components/calls/call-audio-modal';
import { useCallDetailMenu } from '../../components/calls/call-detail-menu';
import CallFilesModal from '../../components/calls/call-files-modal';
import CallImagesModal from '../../components/calls/call-images-modal';
import CallNotesModal from '../../components/calls/call-notes-modal';
import { CloseCallBottomSheet } from '../../components/calls/close-call-bottom-sheet';
import { DispatchSelectionModal } from '../../components/calls/dispatch-selection-modal';
import { RescheduleCallSheet } from '../../components/calls/reschedule-call-sheet';
import { StatusBottomSheet } from '../../components/status/status-bottom-sheet';

type TabKey = 'info' | 'contact' | 'protocols' | 'dispatched' | 'timeline' | 'video' | 'checkin' | 'command';

export default function CallDetailWeb() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { width, height } = useWindowDimensions();
  const { colorScheme } = useColorScheme();

  const isWideScreen = width >= 1024;
  const isDark = colorScheme === 'dark';

  const [coordinates, setCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isCloseCallModalOpen, setIsCloseCallModalOpen] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [mapView, setMapView] = useState<'call' | 'destination'>('call');
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  const { call, callExtraData, callPriority, isLoading, error, fetchCallDetail, reset } = useCallDetailStore();
  const { canUserCreateCalls } = useSecurityStore();
  const { activeCall, activeUnit } = useCoreStore();
  const { setIsOpen: setStatusBottomSheetOpen, setSelectedCall } = useStatusBottomSheetStore();
  const showToast = useToastStore((state) => state.showToast);

  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  const handleBack = () => router.back();

  const openNotesModal = () => {
    useCallDetailStore.getState().fetchCallNotes(callId);
    setIsNotesModalOpen(true);
  };

  const handleEditCall = useCallback(() => router.push(`/call/${callId}/edit` as Href), [router, callId]);
  const handleCloseCall = () => setIsCloseCallModalOpen(true);
  const openAudioModal = () => setIsAudioModalOpen(true);
  const handleRescheduleCall = () => setIsRescheduleModalOpen(true);

  const handleDeleteCall = () => {
    if (typeof window !== 'undefined' && !window.confirm(t('call_detail.delete_call_confirm'))) return;
    void (async () => {
      try {
        await useCallDetailStore.getState().deleteCall(callId);
        showToast('success', t('call_detail.delete_call_success'));
        await useCallsStore.getState().fetchCalls();
        router.back();
      } catch {
        showToast('error', t('call_detail.delete_call_error'));
      }
    })();
  };

  const isScheduledPending = !!(call?.ScheduledOn || call?.ScheduledOnUtc) && !call?.DispatchedOn;

  const handleSetActive = async () => {
    if (!call) return;
    setIsSettingActive(true);
    try {
      await useCoreStore.getState().setActiveCall(call.CallId);
      setSelectedCall(call);
      setStatusBottomSheetOpen(true);
      showToast('success', t('call_detail.set_active_success'));
    } catch (err) {
      logger.error({ message: 'Failed to set call as active', context: { error: err, callId: call.CallId } });
      showToast('error', t('call_detail.set_active_error'));
    } finally {
      setIsSettingActive(false);
    }
  };

  // Dispatch additional resources to this (active) call. Picked resources are unioned with the call's
  // existing dispatches so nothing is un-dispatched; the server then notifies only the newly-added ones.
  const handleDispatchAdditional = async (selection: DispatchSelection) => {
    if (!call) return;

    try {
      await useCallDetailStore.getState().updateCall(buildAddResourcesUpdateRequest(call, callExtraData?.Dispatches, selection, callExtraData?.CallFormData));
      showToast('success', t('call_detail.dispatch_more_success'));
    } catch (err) {
      logger.error({ message: 'Failed to dispatch additional resources', context: { error: err, callId: call.CallId } });
      showToast('error', t('call_detail.dispatch_more_error'));
    }
  };

  const { HeaderRightMenu, CallDetailActionSheet } = useCallDetailMenu({
    onEditCall: handleEditCall,
    onCloseCall: handleCloseCall,
    onDeleteCall: handleDeleteCall,
    onRescheduleCall: isScheduledPending ? handleRescheduleCall : undefined,
    onDispatchMore: call && isCallActive(call.State) ? () => setIsDispatchModalOpen(true) : undefined,
    canUserCreateCalls,
  });

  useEffect(() => {
    reset();
    if (callId) fetchCallDetail(callId);
  }, [callId, fetchCallDetail, reset]);

  useEffect(() => {
    if (call) {
      if (call.Latitude && call.Longitude) {
        setCoordinates({ latitude: parseFloat(call.Latitude), longitude: parseFloat(call.Longitude) });
      } else if (call.Geolocation) {
        const [lat, lng] = call.Geolocation.split(',');
        setCoordinates({ latitude: parseFloat(lat), longitude: parseFloat(lng) });
      }
    }
  }, [call]);

  useEffect(() => {
    if (call) {
      trackEvent('call_detail_web_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
      });
    }
  }, [trackEvent, call]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back();
      }
      if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleEditCall();
      }
      // Tab navigation with number keys
      if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabs: TabKey[] = ['info', 'contact', 'protocols', 'dispatched', 'timeline', 'video', 'checkin'];
        const index = parseInt(e.key) - 1;
        if (tabs[index]) setActiveTab(tabs[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEditCall, router, setActiveTab]);

  const handleRoute = async () => {
    if (!coordinates.latitude || !coordinates.longitude) {
      showToast('error', t('call_detail.no_location_for_routing'));
      return;
    }
    try {
      const destinationName = call?.Address || t('call_detail.call_location');
      const success = await openMapsWithDirections(coordinates.latitude, coordinates.longitude, destinationName, userLatitude || undefined, userLongitude || undefined);
      if (!success) showToast('error', t('call_detail.failed_to_open_maps'));
    } catch (err) {
      logger.error({ message: 'Failed to open maps for routing', context: { error: err, callId, coordinates } });
      showToast('error', t('call_detail.failed_to_open_maps'));
    }
  };

  const checkInStatuses = useCheckInStore((s) => s.timerStatuses);
  const overdueCount = checkInStatuses.filter((s) => s.Status === CheckInTimerStatus.Overdue).length;
  const warningCount = checkInStatuses.filter((s) => s.Status === CheckInTimerStatus.Warning).length;

  const tabs = useMemo(() => {
    const baseTabs: { key: TabKey; title: string; icon: typeof InfoIcon; badge?: number }[] = [
      { key: 'info', title: t('call_detail.tabs.info'), icon: InfoIcon },
      { key: 'contact', title: t('call_detail.tabs.contact'), icon: UserIcon },
      { key: 'protocols', title: t('call_detail.tabs.protocols'), icon: FileTextIcon },
      { key: 'dispatched', title: t('call_detail.tabs.dispatched'), icon: UsersIcon },
      { key: 'timeline', title: t('call_detail.tabs.timeline'), icon: ClockIcon, badge: callExtraData?.Activity?.length || 0 },
      { key: 'video', title: t('call_detail.tabs.video'), icon: VideoIcon },
      { key: 'command', title: t('incident_command.tab_title'), icon: NetworkIcon },
    ];
    if (call?.CheckInTimersEnabled) {
      baseTabs.push({
        key: 'checkin' as const,
        title: t('check_in.tab_title'),
        icon: ShieldCheckIcon,
        badge: overdueCount + warningCount,
      });
    }
    return baseTabs;
  }, [t, callExtraData?.Activity?.length, call?.CheckInTimersEnabled, overdueCount, warningCount]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('call_detail.title'), headerShown: true, headerRight: () => <HeaderRightMenu />, headerBackTitle: '' }} />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          <Loading />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: t('call_detail.title'), headerShown: true, headerRight: () => <HeaderRightMenu />, headerBackTitle: '' }} />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5">
            <ZeroState heading={t('call_detail.not_found')} description={error} isError={true} />
          </Box>
        </View>
      </>
    );
  }

  if (!call) {
    return (
      <>
        <Stack.Screen options={{ title: t('call_detail.title'), headerShown: true, headerBackTitle: '' }} />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5">
            <Text className="text-center">{t('call_detail.not_found')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </View>
      </>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <View style={styles.tabContent}>
            <InfoRow label={t('call_detail.priority')} value={callPriority?.Name || '-'} valueColor={callPriority?.Color} isDark={isDark} />
            <InfoRow label={t('call_detail.timestamp')} value={formatDateForDisplay(parseDateISOString(call.LoggedOn), 'MMM d, yyyy h:mm a')} isDark={isDark} />
            {call.ScheduledOn || call.ScheduledOnUtc ? (
              <InfoRow label={t('call_detail.scheduled_on')} value={formatDateForDisplay(parseDateISOString(call.ScheduledOn || call.ScheduledOnUtc), 'MMM d, yyyy h:mm a')} valueColor="#d97706" isDark={isDark} />
            ) : null}
            <InfoRow label={t('call_detail.type')} value={call.Type || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.address')} value={call.Address || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.destination')} value={call.DestinationName || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.destination_type')} value={call.DestinationTypeName || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.destination_address')} value={call.DestinationAddress || '-'} isDark={isDark} />
            <View style={styles.infoRow}>
              <Text style={StyleSheet.flatten([styles.infoLabel, isDark ? styles.infoLabelDark : styles.infoLabelLight])}>{t('call_detail.note')}</Text>
              <View style={StyleSheet.flatten([styles.noteContainer, isDark ? styles.noteContainerDark : styles.noteContainerLight])}>
                <div style={{ color: isDark ? '#d1d5db' : '#374151', fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(call.Note || '<em>No notes</em>') }} />
              </View>
            </View>
          </View>
        );
      case 'contact':
        return (
          <View style={styles.tabContent}>
            <InfoRow label={t('call_detail.reference_id')} value={call.ReferenceId || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.external_id')} value={call.ExternalId || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.contact_name')} value={call.ContactName || '-'} isDark={isDark} />
            <InfoRow label={t('call_detail.contact_info')} value={call.ContactInfo || '-'} isDark={isDark} />
          </View>
        );
      case 'protocols':
        return (
          <View style={styles.tabContent}>
            {callExtraData?.Protocols && callExtraData.Protocols.length > 0 ? (
              callExtraData.Protocols.map((protocol, index) => (
                <Card key={index} style={StyleSheet.flatten([styles.protocolCard, isDark ? styles.protocolCardDark : styles.protocolCardLight])}>
                  <Text style={StyleSheet.flatten([styles.protocolName, isDark ? styles.protocolNameDark : styles.protocolNameLight])}>{protocol.Name}</Text>
                  <Text style={StyleSheet.flatten([styles.protocolDescription, isDark ? styles.protocolDescriptionDark : styles.protocolDescriptionLight])}>{protocol.Description}</Text>
                  <View style={StyleSheet.flatten([styles.protocolText, isDark ? styles.protocolTextDark : styles.protocolTextLight])}>
                    <div style={{ color: isDark ? '#d1d5db' : '#374151', fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(protocol.ProtocolText || '') }} />
                  </View>
                </Card>
              ))
            ) : (
              <Text style={StyleSheet.flatten([styles.emptyText, isDark ? styles.emptyTextDark : styles.emptyTextLight])}>{t('call_detail.no_protocols')}</Text>
            )}
          </View>
        );
      case 'dispatched':
        return (
          <View style={styles.tabContent}>
            {canUserCreateCalls && call && isCallActive(call.State) ? (
              <View className="mb-4">
                <EscalateAlarmButton
                  callId={call.CallId}
                  alarmLevel={call.AlarmLevel}
                  activeRunCardId={call.ActiveRunCardId ?? null}
                  canEscalate={!!canUserCreateCalls && isCallActive(call.State)}
                  onEscalated={() => fetchCallDetail(callId)}
                />
              </View>
            ) : null}
            {canUserCreateCalls && call && isCallActive(call.State) ? (
              <Button variant="solid" action="primary" size="sm" onPress={() => setIsDispatchModalOpen(true)} className="mb-4">
                <ButtonIcon as={UserPlusIcon} className="mr-2" />
                <ButtonText>{t('call_detail.dispatch_more')}</ButtonText>
              </Button>
            ) : null}
            {callExtraData?.Dispatches && callExtraData.Dispatches.length > 0 ? (
              callExtraData.Dispatches.map((dispatched, index) => (
                <Card key={index} style={StyleSheet.flatten([styles.dispatchCard, isDark ? styles.dispatchCardDark : styles.dispatchCardLight])}>
                  <Text style={StyleSheet.flatten([styles.dispatchName, isDark ? styles.dispatchNameDark : styles.dispatchNameLight])}>{dispatched.Name}</Text>
                  <View style={styles.dispatchMeta}>
                    <Text style={StyleSheet.flatten([styles.dispatchMetaText, isDark ? styles.dispatchMetaTextDark : styles.dispatchMetaTextLight])}>
                      {t('call_detail.group')}: {dispatched.Group}
                    </Text>
                    <Text style={StyleSheet.flatten([styles.dispatchMetaText, isDark ? styles.dispatchMetaTextDark : styles.dispatchMetaTextLight])}>
                      {t('call_detail.type')}: {dispatched.Type}
                    </Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text style={StyleSheet.flatten([styles.emptyText, isDark ? styles.emptyTextDark : styles.emptyTextLight])}>{t('call_detail.no_dispatched')}</Text>
            )}
          </View>
        );
      case 'video':
        return (
          <View style={styles.tabContent}>
            <VideoFeedsTab callId={call.CallId} canEdit={canUserCreateCalls ?? false} />
          </View>
        );
      case 'checkin':
        return call?.CheckInTimersEnabled ? (
          <View style={styles.tabContent}>
            <CheckInTab callId={parseInt(call.CallId)} checkInTimersEnabled={true} />
          </View>
        ) : null;
      case 'timeline':
        return (
          <View style={styles.tabContent}>
            {callExtraData?.Activity && callExtraData.Activity.length > 0 ? (
              <View style={styles.timeline}>
                {callExtraData.Activity.map((event, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <View style={StyleSheet.flatten([styles.timelineDot, { backgroundColor: event.StatusColor || '#3b82f6' }])} />
                    <View style={styles.timelineContent}>
                      <Text style={StyleSheet.flatten([styles.timelineStatus, { color: event.StatusColor || (isDark ? '#d1d5db' : '#374151') }])}>{event.StatusText}</Text>
                      <Text style={StyleSheet.flatten([styles.timelineInfo, isDark ? styles.timelineInfoDark : styles.timelineInfoLight])}>
                        {event.Name} - {event.Group}
                      </Text>
                      <Text style={StyleSheet.flatten([styles.timelineTime, isDark ? styles.timelineTimeDark : styles.timelineTimeLight])}>{new Date(event.Timestamp).toLocaleString()}</Text>
                      {event.Note ? <Text style={StyleSheet.flatten([styles.timelineNote, isDark ? styles.timelineNoteDark : styles.timelineNoteLight])}>{event.Note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={StyleSheet.flatten([styles.emptyText, isDark ? styles.emptyTextDark : styles.emptyTextLight])}>{t('call_detail.no_timeline')}</Text>
            )}
          </View>
        );
      case 'command':
        return (
          <View style={styles.tabContent}>
            <IncidentCommandTab callId={call.CallId} showOpenFull />
          </View>
        );
    }
  };

  // Map can toggle between the call (dispatch) location and the call's destination POI location.
  const hasDestinationLocation = call?.DestinationLatitude != null && call?.DestinationLongitude != null;
  const showDestinationMap = mapView === 'destination' && hasDestinationLocation;
  const mapLatitude = showDestinationMap ? (call?.DestinationLatitude ?? null) : coordinates.latitude;
  const mapLongitude = showDestinationMap ? (call?.DestinationLongitude ?? null) : coordinates.longitude;
  const mapAddress = showDestinationMap ? call?.DestinationAddress || call?.DestinationName : call?.Address;

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: t('call_detail.title'), headerShown: true, headerRight: () => <HeaderRightMenu />, headerBackTitle: '' }} />

      <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleContainer}>
                <Text style={StyleSheet.flatten([styles.callNumber, isDark ? styles.callNumberDark : styles.callNumberLight])}>#{call.Number}</Text>
                <Text style={StyleSheet.flatten([styles.callName, isDark ? styles.callNameDark : styles.callNameLight])}>{call.Name}</Text>
              </View>
              <View style={styles.headerActions}>
                {activeUnit && activeCall?.CallId !== call.CallId ? (
                  <Pressable style={StyleSheet.flatten([styles.setActiveButton, isSettingActive ? styles.setActiveButtonDisabled : {}])} onPress={handleSetActive} disabled={isSettingActive}>
                    {isSettingActive ? <LoaderIcon size={16} color="#fff" /> : null}
                    <Text style={styles.setActiveButtonText}>{isSettingActive ? t('call_detail.setting_active') : t('call_detail.set_active')}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={StyleSheet.flatten([styles.editButton, isDark ? styles.editButtonDark : styles.editButtonLight])} onPress={handleEditCall}>
                  <EditIcon size={16} color={isDark ? '#d1d5db' : '#374151'} />
                  <Text style={StyleSheet.flatten([styles.editButtonText, isDark ? styles.editButtonTextDark : styles.editButtonTextLight])}>{t('common.edit')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Call Nature */}
            <View style={StyleSheet.flatten([styles.natureContainer, isDark ? styles.natureContainerDark : styles.natureContainerLight])}>
              <div style={{ color: isDark ? '#d1d5db' : '#374151', fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(call.Nature || '') }} />
            </View>

            {/* Priority Badge */}
            {callPriority ? (
              <View style={StyleSheet.flatten([styles.priorityBadge, { backgroundColor: `${callPriority.Color}20`, borderColor: callPriority.Color }])}>
                <View style={StyleSheet.flatten([styles.priorityDot, { backgroundColor: callPriority.Color }])} />
                <Text style={StyleSheet.flatten([styles.priorityText, { color: callPriority.Color }])}>{callPriority.Name}</Text>
              </View>
            ) : null}

            {/* Renders only once the call has been escalated past the first alarm. */}
            <AlarmLevelBadge alarmLevel={call.AlarmLevel} />
          </View>

          {/* Main Content - Two Column on Wide Screens */}
          <View style={isWideScreen ? styles.twoColumnLayout : styles.singleColumnLayout}>
            {/* Left Column - Map & Actions */}
            <View style={isWideScreen ? styles.leftColumn : styles.fullWidth}>
              {/* Map (toggles between the call address and the destination POI when one exists) */}
              {mapLatitude && mapLongitude ? (
                <Card style={StyleSheet.flatten([styles.mapCard, isDark ? styles.mapCardDark : styles.mapCardLight])}>
                  {hasDestinationLocation ? (
                    <View style={styles.mapToggleRow}>
                      <Pressable
                        style={StyleSheet.flatten([styles.mapToggleButton, mapView === 'call' ? styles.mapToggleButtonActive : isDark ? styles.mapToggleButtonDark : styles.mapToggleButtonLight])}
                        onPress={() => setMapView('call')}
                      >
                        <MapPinIcon size={14} color={mapView === 'call' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
                        <Text style={StyleSheet.flatten([styles.mapToggleText, mapView === 'call' ? styles.mapToggleTextActive : isDark ? styles.mapToggleTextDark : styles.mapToggleTextLight])}>
                          {t('call_detail.map_call')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={StyleSheet.flatten([styles.mapToggleButton, mapView === 'destination' ? styles.mapToggleButtonActive : isDark ? styles.mapToggleButtonDark : styles.mapToggleButtonLight])}
                        onPress={() => setMapView('destination')}
                      >
                        <NavigationIcon size={14} color={mapView === 'destination' ? '#fff' : isDark ? '#9ca3af' : '#4b5563'} />
                        <Text style={StyleSheet.flatten([styles.mapToggleText, mapView === 'destination' ? styles.mapToggleTextActive : isDark ? styles.mapToggleTextDark : styles.mapToggleTextLight])}>
                          {t('call_detail.map_destination')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <StaticMap latitude={mapLatitude} longitude={mapLongitude} address={mapAddress} zoom={15} height={isWideScreen ? 300 : 200} showUserLocation={true} />
                  <Pressable style={styles.routeOverlay} onPress={handleRoute}>
                    <RouteIcon size={20} color="#fff" />
                    <Text style={styles.routeOverlayText}>{t('common.route')}</Text>
                  </Pressable>
                </Card>
              ) : null}

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <ActionButton icon={FileTextIcon} label={t('call_detail.notes')} badge={call.NotesCount} onPress={openNotesModal} isDark={isDark} />
                <ActionButton icon={ImageIcon} label={t('call_detail.images')} badge={call.ImgagesCount} onPress={() => setIsImagesModalOpen(true)} isDark={isDark} />
                <ActionButton icon={PaperclipIcon} label={t('call_detail.files.button')} badge={call.FileCount} onPress={() => setIsFilesModalOpen(true)} isDark={isDark} />
                <ActionButton icon={Volume2Icon} label={t('call_detail.audio')} badge={call.AudioCount} onPress={openAudioModal} isDark={isDark} />
                <ActionButton icon={XCircleIcon} label={t('call_detail.close_call')} onPress={handleCloseCall} isDark={isDark} variant="danger" />
              </View>
            </View>

            {/* Right Column - Tabs */}
            <View style={isWideScreen ? styles.rightColumn : styles.fullWidth}>
              <Card style={StyleSheet.flatten([styles.tabsCard, isDark ? styles.tabsCardDark : styles.tabsCardLight])}>
                {/* Tab Navigation */}
                <View style={styles.tabNav}>
                  {tabs.map((tab) => (
                    <Pressable
                      key={tab.key}
                      style={StyleSheet.flatten([styles.tabButton, activeTab === tab.key ? (isDark ? styles.tabButtonActiveDark : styles.tabButtonActiveLight) : {}])}
                      onPress={() => setActiveTab(tab.key)}
                    >
                      <tab.icon size={16} color={activeTab === tab.key ? '#2563eb' : isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={StyleSheet.flatten([styles.tabButtonText, activeTab === tab.key ? styles.tabButtonTextActive : isDark ? styles.tabButtonTextDark : styles.tabButtonTextLight])}>{tab.title}</Text>
                      {tab.badge ? (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>

                {/* Tab Content */}
                {renderTabContent()}
              </Card>
            </View>
          </View>

          {/* Keyboard Shortcuts Hint */}
          <View style={styles.shortcutHint}>
            <Text style={StyleSheet.flatten([styles.shortcutText, isDark ? styles.shortcutTextDark : styles.shortcutTextLight])}>
              {t('call_detail.keyboard_shortcuts', 'Tip: Press 1-5 to switch tabs, Ctrl+E to edit, Escape to go back')}
            </Text>
          </View>
        </ScrollView>
      </View>

      <CallNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} callId={callId} />
      <CallImagesModal isOpen={isImagesModalOpen} onClose={() => setIsImagesModalOpen(false)} callId={callId} />
      <CallFilesModal isOpen={isFilesModalOpen} onClose={() => setIsFilesModalOpen(false)} callId={callId} />
      <CallAudioModal isOpen={isAudioModalOpen} onClose={() => setIsAudioModalOpen(false)} callId={callId} />
      <CloseCallBottomSheet isOpen={isCloseCallModalOpen} onClose={() => setIsCloseCallModalOpen(false)} callId={callId} />
      <RescheduleCallSheet isOpen={isRescheduleModalOpen} onClose={() => setIsRescheduleModalOpen(false)} callId={callId} />
      <StatusBottomSheet />
      <DispatchSelectionModal isVisible={isDispatchModalOpen} onClose={() => setIsDispatchModalOpen(false)} onConfirm={handleDispatchAdditional} initialSelection={EMPTY_DISPATCH_SELECTION} />
      <CallDetailActionSheet />
    </>
  );
}

// Helper Components
interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
  isDark: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, valueColor, isDark }) => (
  <View style={styles.infoRow}>
    <Text style={StyleSheet.flatten([styles.infoLabel, isDark ? styles.infoLabelDark : styles.infoLabelLight])}>{label}</Text>
    <Text style={StyleSheet.flatten([styles.infoValue, isDark ? styles.infoValueDark : styles.infoValueLight, valueColor ? { color: valueColor } : {}])}>{value}</Text>
  </View>
);

interface ActionButtonProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  badge?: number;
  onPress: () => void;
  isDark: boolean;
  variant?: 'default' | 'danger';
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, badge, onPress, isDark, variant = 'default' }) => (
  <Pressable style={StyleSheet.flatten([styles.actionButton, isDark ? styles.actionButtonDark : styles.actionButtonLight, variant === 'danger' ? styles.actionButtonDanger : {}])} onPress={onPress}>
    <View style={styles.actionButtonIconContainer}>
      <Icon size={20} color={variant === 'danger' ? '#ef4444' : isDark ? '#d1d5db' : '#374151'} />
      {badge ? (
        <View style={styles.actionButtonBadge}>
          <Text style={styles.actionButtonBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
    <Text style={StyleSheet.flatten([styles.actionButtonText, isDark ? styles.actionButtonTextDark : styles.actionButtonTextLight, variant === 'danger' ? styles.actionButtonTextDanger : {}])}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },
  containerLight: {
    backgroundColor: '#fafafa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  callNumber: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  callNumberDark: {
    color: '#9ca3af',
  },
  callNumberLight: {
    color: '#6b7280',
  },
  callName: {
    fontSize: 28,
    fontWeight: '700',
  },
  callNameDark: {
    color: '#ffffff',
  },
  callNameLight: {
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  setActiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  setActiveButtonDisabled: {
    opacity: 0.6,
  },
  setActiveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButtonDark: {
    borderColor: '#404040',
    backgroundColor: '#171717',
  },
  editButtonLight: {
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editButtonTextDark: {
    color: '#d1d5db',
  },
  editButtonTextLight: {
    color: '#374151',
  },
  natureContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  natureContainerDark: {
    backgroundColor: '#171717',
  },
  natureContainerLight: {
    backgroundColor: '#f3f4f6',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 24,
  },
  singleColumnLayout: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumn: {
    width: 400,
    gap: 16,
  },
  rightColumn: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
    marginBottom: 16,
  },
  mapCard: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mapCardDark: {
    backgroundColor: '#171717',
  },
  mapCardLight: {
    backgroundColor: '#ffffff',
  },
  mapToggleRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
  },
  mapToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mapToggleButtonActive: {
    backgroundColor: '#2563eb',
  },
  mapToggleButtonLight: {
    backgroundColor: '#e5e7eb',
  },
  mapToggleButtonDark: {
    backgroundColor: '#374151',
  },
  mapToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapToggleTextActive: {
    color: '#ffffff',
  },
  mapToggleTextLight: {
    color: '#4b5563',
  },
  mapToggleTextDark: {
    color: '#9ca3af',
  },
  routeOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  routeOverlayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonDark: {
    backgroundColor: '#171717',
    borderColor: '#262626',
  },
  actionButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  actionButtonDanger: {
    borderColor: '#fecaca',
  },
  actionButtonIconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  actionButtonBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtonTextDark: {
    color: '#d1d5db',
  },
  actionButtonTextLight: {
    color: '#374151',
  },
  actionButtonTextDanger: {
    color: '#ef4444',
  },
  tabsCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tabsCardDark: {
    backgroundColor: '#171717',
    borderColor: '#262626',
  },
  tabsCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  tabNav: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tabButtonActiveDark: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabButtonActiveLight: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#2563eb',
  },
  tabButtonTextDark: {
    color: '#9ca3af',
  },
  tabButtonTextLight: {
    color: '#6b7280',
  },
  tabBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  tabContent: {
    padding: 20,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoLabelDark: {
    color: '#9ca3af',
  },
  infoLabelLight: {
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoValueDark: {
    color: '#ffffff',
  },
  infoValueLight: {
    color: '#111827',
  },
  noteContainer: {
    padding: 16,
    borderRadius: 8,
    marginTop: 4,
  },
  noteContainerDark: {
    backgroundColor: '#262626',
  },
  noteContainerLight: {
    backgroundColor: '#f9fafb',
  },
  protocolCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  protocolCardDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  protocolCardLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  protocolName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  protocolNameDark: {
    color: '#ffffff',
  },
  protocolNameLight: {
    color: '#111827',
  },
  protocolDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  protocolDescriptionDark: {
    color: '#9ca3af',
  },
  protocolDescriptionLight: {
    color: '#6b7280',
  },
  protocolText: {
    padding: 12,
    borderRadius: 6,
  },
  protocolTextDark: {
    backgroundColor: '#171717',
  },
  protocolTextLight: {
    backgroundColor: '#ffffff',
  },
  dispatchCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  dispatchCardDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  dispatchCardLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  dispatchName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  dispatchNameDark: {
    color: '#ffffff',
  },
  dispatchNameLight: {
    color: '#111827',
  },
  dispatchMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  dispatchMetaText: {
    fontSize: 13,
  },
  dispatchMetaTextDark: {
    color: '#9ca3af',
  },
  dispatchMetaTextLight: {
    color: '#6b7280',
  },
  timeline: {
    position: 'relative',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  timelineInfo: {
    fontSize: 14,
    marginBottom: 2,
  },
  timelineInfoDark: {
    color: '#d1d5db',
  },
  timelineInfoLight: {
    color: '#374151',
  },
  timelineTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  timelineTimeDark: {
    color: '#9ca3af',
  },
  timelineTimeLight: {
    color: '#6b7280',
  },
  timelineNote: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  timelineNoteDark: {
    color: '#9ca3af',
  },
  timelineNoteLight: {
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  emptyTextDark: {
    color: '#9ca3af',
  },
  emptyTextLight: {
    color: '#6b7280',
  },
  shortcutHint: {
    marginTop: 24,
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 12,
  },
  shortcutTextDark: {
    color: '#6b7280',
  },
  shortcutTextLight: {
    color: '#9ca3af',
  },
});
