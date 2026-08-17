import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ClockIcon,
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
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import WebView from 'react-native-webview';

import { VideoFeedsTab } from '@/components/callVideoFeeds/video-feeds-tab';
import { CheckInTab } from '@/components/checkIn/check-in-tab';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { IncidentCommandTab } from '@/components/incident-command/incident-command-tab';
// Import a static map component instead of react-native-maps
import StaticMap from '@/components/maps/static-map';
import { AlarmLevelBadge } from '@/components/runcards/alarm-level-badge';
import { EscalateAlarmButton } from '@/components/runcards/escalate-alarm-button';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
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
import { sanitizeHtmlContent } from '@/utils/html-sanitizer';

import CallAudioModal from '../../components/calls/call-audio-modal';
import { useCallDetailMenu } from '../../components/calls/call-detail-menu';
import CallFilesModal from '../../components/calls/call-files-modal';
import CallImagesModal from '../../components/calls/call-images-modal';
import CallNotesModal from '../../components/calls/call-notes-modal';
import { CloseCallBottomSheet } from '../../components/calls/close-call-bottom-sheet';
import { DispatchSelectionModal } from '../../components/calls/dispatch-selection-modal';
import { RescheduleCallSheet } from '../../components/calls/reschedule-call-sheet';
import { StatusBottomSheet } from '../../components/status/status-bottom-sheet';

export default function CallDetail() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [coordinates, setCoordinates] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });
  const { call, callExtraData, callPriority, isLoading, error, fetchCallDetail, reset } = useCallDetailStore();
  const { canUserCreateCalls } = useSecurityStore();
  const { activeCall, activeStatuses, activeUnit } = useCoreStore();
  const { setIsOpen: setStatusBottomSheetOpen, setSelectedCall } = useStatusBottomSheetStore();
  const timerStatuses = useCheckInStore((state) => state.timerStatuses);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isCloseCallModalOpen, setIsCloseCallModalOpen] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [mapView, setMapView] = useState<'call' | 'destination'>('call');
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const { colorScheme } = useColorScheme();
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  // Get current user location from the location store
  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  const handleBack = () => {
    router.back();
  };

  const openNotesModal = () => {
    useCallDetailStore.getState().fetchCallNotes(callId);
    setIsNotesModalOpen(true);
  };

  const openImagesModal = () => {
    setIsImagesModalOpen(true);
  };

  const openFilesModal = () => {
    setIsFilesModalOpen(true);
  };

  const openAudioModal = () => {
    setIsAudioModalOpen(true);
  };

  const handleEditCall = () => {
    router.push(`/call/${callId}/edit` as Href);
  };

  const handleCloseCall = () => {
    setIsCloseCallModalOpen(true);
  };

  const handleRescheduleCall = () => {
    setIsRescheduleModalOpen(true);
  };

  const handleDeleteCall = () => {
    Alert.alert(t('call_detail.delete_call'), t('call_detail.delete_call_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('call_detail.delete_call'),
        style: 'destructive',
        onPress: async () => {
          try {
            await useCallDetailStore.getState().deleteCall(callId);
            showToast('success', t('call_detail.delete_call_success'));
            await useCallsStore.getState().fetchCalls();
            router.back();
          } catch {
            showToast('error', t('call_detail.delete_call_error'));
          }
        },
      },
    ]);
  };

  const handleSetActive = async () => {
    if (!call) return;

    setIsSettingActive(true);

    try {
      // Set this call as the active call in the core store
      await useCoreStore.getState().setActiveCall(call.CallId);

      // Pre-select the current call and open the status bottom sheet without a pre-selected status
      setSelectedCall(call);
      setStatusBottomSheetOpen(true); // No status provided, will start with status selection

      // Show success message
      showToast('success', t('call_detail.set_active_success'));
    } catch (error) {
      logger.error({
        message: 'Failed to set call as active',
        context: { error, callId: call.CallId },
      });
      showToast('error', t('call_detail.set_active_error'));
    } finally {
      setIsSettingActive(false);
    }
  };

  // Dispatch additional resources to this (active) call. The picked resources are unioned with the
  // call's existing dispatches so nothing is ever un-dispatched — the server then notifies only the
  // newly-added resources (RebroadcastCall stays false).
  const handleDispatchAdditional = async (selection: DispatchSelection) => {
    if (!call) return;

    try {
      await useCallDetailStore.getState().updateCall(buildAddResourcesUpdateRequest(call, callExtraData?.Dispatches, selection, callExtraData?.CallFormData));
      showToast('success', t('call_detail.dispatch_more_success'));
    } catch (error) {
      logger.error({ message: 'Failed to dispatch additional resources', context: { error, callId: call.CallId } });
      showToast('error', t('call_detail.dispatch_more_error'));
    }
  };

  const isScheduledPending = !!(call?.ScheduledOn || call?.ScheduledOnUtc) && !call?.DispatchedOn;

  // Initialize the call detail menu hook
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
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [callId, fetchCallDetail, reset]);

  useEffect(() => {
    if (call) {
      if (call.Latitude && call.Longitude) {
        setCoordinates({
          latitude: parseFloat(call.Latitude),
          longitude: parseFloat(call.Longitude),
        });
      } else if (call.Geolocation) {
        const [lat, lng] = call.Geolocation.split(',');
        setCoordinates({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        });
      }
    }
  }, [call]);

  // Track when call detail view is rendered
  useEffect(() => {
    if (call) {
      trackEvent('call_detail_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        callNumber: call.Number || '',
        callPriority: call.Priority || 0,
        callType: call.Type || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
        hasAddress: !!call.Address,
        hasNotes: (call.NotesCount || 0) > 0,
        hasImages: (call.ImgagesCount || 0) > 0,
        hasFiles: (call.FileCount || 0) > 0,
        hasExtraData: !!callExtraData,
        hasProtocols: !!callExtraData?.Protocols?.length,
        hasDispatches: !!callExtraData?.Dispatches?.length,
        hasTimeline: !!callExtraData?.Activity?.length,
      });
    }
  }, [trackEvent, call, callExtraData]);

  /**
   * Opens the device's native maps application with directions to the call location
   */
  const handleRoute = async () => {
    if (!coordinates.latitude || !coordinates.longitude) {
      showToast('error', t('call_detail.no_location_for_routing'));
      return;
    }

    try {
      const destinationName = call?.Address || t('call_detail.call_location');
      const success = await openMapsWithDirections(coordinates.latitude, coordinates.longitude, destinationName, userLatitude || undefined, userLongitude || undefined);

      if (!success) {
        showToast('error', t('call_detail.failed_to_open_maps'));
      }
    } catch (error) {
      logger.error({
        message: 'Failed to open maps for routing',
        context: { error, callId, coordinates },
      });
      showToast('error', t('call_detail.failed_to_open_maps'));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerRight: () => <HeaderRightMenu />,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Loading />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerRight: () => <HeaderRightMenu />,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <ZeroState heading={t('call_detail.not_found')} description={error} isError={true} />
          </Box>
        </View>
      </>
    );
  }

  if (!call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <SafeAreaView className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="text-center">{t('call_detail.not_found')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </SafeAreaView>
      </>
    );
  }

  const renderTabs = () => {
    const tabs: TabItem[] = [
      {
        key: 'info',
        title: t('call_detail.tabs.info'),
        icon: <InfoIcon size={16} />,
        content: (
          <Box className="p-4">
            <VStack className="space-y-3">
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.priority')}</Text>
                <Text className="font-medium" style={{ color: callPriority?.Color }}>
                  {callPriority?.Name}
                </Text>
              </Box>
              {/* Renders only once the call has been escalated past the first alarm. */}
              {call.AlarmLevel > 1 ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('run_cards.alarm_level_label')}</Text>
                  <Box className="mt-1 flex-row">
                    <AlarmLevelBadge alarmLevel={call.AlarmLevel} />
                  </Box>
                </Box>
              ) : null}
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.timestamp')}</Text>
                <Text className="font-medium">{formatDateForDisplay(parseDateISOString(call.LoggedOn), 'MMM d, h:mm a')}</Text>
              </Box>
              {call.ScheduledOn || call.ScheduledOnUtc ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('call_detail.scheduled_on')}</Text>
                  <Text className="font-medium text-amber-600 dark:text-amber-400">{formatDateForDisplay(parseDateISOString(call.ScheduledOn || call.ScheduledOnUtc), 'MMM d, yyyy h:mm a')}</Text>
                </Box>
              ) : null}
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.type')}</Text>
                <Text className="font-medium">{call.Type}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.address')}</Text>
                <Text className="font-medium">{call.Address}</Text>
              </Box>
              {call.DestinationName ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('call_detail.destination')}</Text>
                  <Text className="font-medium">{call.DestinationName}</Text>
                </Box>
              ) : null}
              {call.DestinationTypeName ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('call_detail.destination_type')}</Text>
                  <Text className="font-medium">{call.DestinationTypeName}</Text>
                </Box>
              ) : null}
              {call.DestinationAddress ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('call_detail.destination_address')}</Text>
                  <Text className="font-medium">{call.DestinationAddress}</Text>
                </Box>
              ) : null}
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.note')}</Text>
                <Box>
                  <WebView
                    style={[styles.container, { height: 200 }]}
                    originWhitelist={['*']}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    source={{
                      html: `
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                                    <style>
                                      body {
                                        color: ${textColor};
                                        font-family: system-ui, -apple-system, sans-serif;
                                        margin: 0;
                                        padding: 0;
                                        font-size: 16px;
                                        line-height: 1.5;
                                      }
                                      * {
                                        max-width: 100%;
                                      }
                                    </style>
                                  </head>
                                  <body>${sanitizeHtmlContent(call.Note ?? '')}</body>
                                </html>
                              `,
                    }}
                    androidLayerType="software"
                  />
                </Box>
              </Box>
            </VStack>
          </Box>
        ),
      },
      {
        key: 'contact',
        title: t('call_detail.tabs.contact'),
        icon: <UserIcon size={16} />,
        content: (
          <Box className="p-4">
            <VStack className="space-y-3">
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.reference_id')}</Text>
                <Text className="font-medium">{call.ReferenceId}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.external_id')}</Text>
                <Text className="font-medium">{call.ExternalId}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.contact_name')}</Text>
                <Text className="font-medium">{call.ContactName}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.contact_info')}</Text>
                <Text className="font-medium">{call.ContactInfo}</Text>
              </Box>
            </VStack>
          </Box>
        ),
      },
      {
        key: 'protocols',
        title: t('call_detail.tabs.protocols'),
        icon: <FileTextIcon size={16} />,
        content: (
          <Box className="p-4">
            {callExtraData?.Protocols && callExtraData.Protocols.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Protocols.map((protocol, index) => (
                  <Box key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    <Text className="font-semibold">{protocol.Name}</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{protocol.Description}</Text>
                    <Box>
                      <WebView
                        style={[styles.container, { height: 200 }]}
                        originWhitelist={['*']}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                        source={{
                          html: `
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                                    <style>
                                      body {
                                        color: ${textColor};
                                        font-family: system-ui, -apple-system, sans-serif;
                                        margin: 0;
                                        padding: 0;
                                        font-size: 16px;
                                        line-height: 1.5;
                                      }
                                      * {
                                        max-width: 100%;
                                      }
                                    </style>
                                  </head>
                                  <body>${sanitizeHtmlContent(protocol.ProtocolText ?? '')}</body>
                                </html>
                              `,
                        }}
                        androidLayerType="software"
                      />
                    </Box>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_protocols')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'dispatched',
        title: t('call_detail.tabs.dispatched'),
        icon: <UsersIcon size={16} />,
        content: (
          <Box className="p-4">
            {canUserCreateCalls && isCallActive(call.State) ? (
              <Box className="mb-4">
                <EscalateAlarmButton
                  callId={call.CallId}
                  alarmLevel={call.AlarmLevel}
                  activeRunCardId={call.ActiveRunCardId ?? null}
                  canEscalate={!!canUserCreateCalls && isCallActive(call.State)}
                  onEscalated={() => fetchCallDetail(callId)}
                />
              </Box>
            ) : null}
            {canUserCreateCalls && isCallActive(call.State) ? (
              <Button variant="solid" action="primary" size="sm" className="mb-4" onPress={() => setIsDispatchModalOpen(true)}>
                <ButtonIcon as={UserPlusIcon} className="mr-2" />
                <ButtonText>{t('call_detail.dispatch_more')}</ButtonText>
              </Button>
            ) : null}
            {callExtraData?.Dispatches && callExtraData.Dispatches.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Dispatches.map((dispatched, index) => (
                  <Box key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    <Text className="font-semibold">{dispatched.Name}</Text>
                    <HStack className="mt-1">
                      <Text className="mr-2 text-sm text-gray-600">
                        {t('call_detail.group')}: {dispatched.Group}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('call_detail.type')}: {dispatched.Type}
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_dispatched')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'timeline',
        title: t('call_detail.tabs.timeline'),
        icon: <ClockIcon size={16} />,
        badge: callExtraData?.Activity?.length || 0,
        content: (
          <Box className="p-4">
            {callExtraData?.Activity && callExtraData.Activity.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Activity.map((event, index) => (
                  <Box key={index} className="border-l-4 border-blue-500 py-1 pl-3">
                    <Text className="font-semibold" style={{ color: event.StatusColor }}>
                      {event.StatusText}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {event.Name} - {event.Group}
                    </Text>
                    <Text className="text-xs text-gray-500">{new Date(event.Timestamp).toLocaleString()}</Text>
                    <Text className="text-xs text-gray-500">{event.Note}</Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_timeline')}</Text>
            )}
          </Box>
        ),
      },
    ];

    // Incident Command tab — lets dispatch see and interact with the established incident command.
    tabs.push({
      key: 'command',
      title: t('incident_command.tab_title'),
      icon: <NetworkIcon size={16} />,
      content: <IncidentCommandTab callId={call.CallId} showOpenFull />,
    });

    // Video feeds tab
    tabs.push({
      key: 'video',
      title: t('call_detail.tabs.video'),
      icon: <VideoIcon size={16} />,
      content: <VideoFeedsTab callId={call.CallId} canEdit={canUserCreateCalls ?? false} />,
    });

    if (call?.CheckInTimersEnabled) {
      // Align with the check-in tab's own summary, which treats Red==Overdue, Yellow==Warning, and counts Critical.
      const overdueCount = timerStatuses.filter((s) => s.Status === CheckInTimerStatus.Overdue || s.Status === CheckInTimerStatus.Red).length;
      const warningCount = timerStatuses.filter((s) => s.Status === CheckInTimerStatus.Warning || s.Status === CheckInTimerStatus.Yellow).length;
      const criticalCount = timerStatuses.filter((s) => s.Status === CheckInTimerStatus.Critical).length;
      const badgeCount = overdueCount + warningCount + criticalCount;

      tabs.push({
        key: 'checkin',
        title: t('check_in.tab_title'),
        icon: <ShieldCheckIcon size={16} />,
        badge: badgeCount,
        content: <CheckInTab callId={parseInt(call.CallId)} checkInTimersEnabled={true} />,
      });
    }

    return tabs;
  };

  // Map can toggle between the call (dispatch) location and the call's destination POI location.
  const hasDestinationLocation = call.DestinationLatitude != null && call.DestinationLongitude != null;
  const showDestinationMap = mapView === 'destination' && hasDestinationLocation;
  const mapLatitude = showDestinationMap ? call.DestinationLatitude : coordinates.latitude;
  const mapLongitude = showDestinationMap ? call.DestinationLongitude : coordinates.longitude;
  const mapAddress = showDestinationMap ? call.DestinationAddress || call.DestinationName : call.Address;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('call_detail.title'),
          headerShown: true,
          headerRight: () => <HeaderRightMenu />,
          headerBackTitle: '',
        }}
      />
      <ScrollView className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Header */}
        <Box className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
          <HStack className="mb-2 items-center justify-between">
            <Heading size="md">
              {call.Name} ({call.Number})
            </Heading>
            {/* Show "Set Active" button if this call is not the active call and there is an active unit */}
            {activeUnit && activeCall?.CallId !== call.CallId && (
              <Button variant="solid" size="sm" onPress={handleSetActive} disabled={isSettingActive} className={`${isSettingActive ? 'bg-primary-400 opacity-80' : 'bg-primary-500'} shadow-lg`}>
                {isSettingActive && <ButtonIcon as={LoaderIcon} className="mr-1 animate-spin text-white" />}
                <ButtonText className="font-medium text-white">{isSettingActive ? t('call_detail.setting_active') : t('call_detail.set_active')}</ButtonText>
              </Button>
            )}
          </HStack>
          <VStack className="space-y-1">
            <Box style={{ height: 80 }}>
              <WebView
                style={[styles.container, { height: 80 }]}
                originWhitelist={['*']}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                source={{
                  html: `
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                                    <style>
                                      body {
                                        color: ${textColor};
                                        font-family: system-ui, -apple-system, sans-serif;
                                        margin: 0;
                                        padding: 0;
                                        font-size: 16px;
                                        line-height: 1.5;
                                      }
                                      * {
                                        max-width: 100%;
                                      }
                                    </style>
                                  </head>
                                  <body>${sanitizeHtmlContent(call.Nature ?? '')}</body>
                                </html>
                              `,
                }}
                androidLayerType="software"
              />
            </Box>
          </VStack>
        </Box>

        {/* Map (toggles between the call address and the destination POI when one exists) */}
        <Box className="mx-4 mt-3 overflow-hidden rounded-xl shadow-xs">
          {hasDestinationLocation ? (
            <HStack className="bg-white px-4 py-3 dark:bg-gray-800" space="sm">
              <Button variant={mapView === 'call' ? 'solid' : 'outline'} size="sm" className="flex-1" onPress={() => setMapView('call')}>
                <ButtonIcon as={MapPinIcon} className="mr-1" />
                <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.map_call')}</ButtonText>
              </Button>
              <Button variant={mapView === 'destination' ? 'solid' : 'outline'} size="sm" className="flex-1" onPress={() => setMapView('destination')}>
                <ButtonIcon as={NavigationIcon} className="mr-1" />
                <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.map_destination')}</ButtonText>
              </Button>
            </HStack>
          ) : null}
          {mapLatitude && mapLongitude ? <StaticMap latitude={mapLatitude} longitude={mapLongitude} address={mapAddress} zoom={15} height={200} showUserLocation={true} /> : null}
        </Box>

        {/* Action Buttons */}
        <HStack className="mx-4 mt-3 justify-around rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
          <Box className="relative mx-1 flex-1">
            <Button onPress={() => openNotesModal()} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={FileTextIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.notes')}</ButtonText>
            </Button>
            {call?.NotesCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.NotesCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={openImagesModal} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={ImageIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.images')}</ButtonText>
            </Button>
            {call?.ImgagesCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.ImgagesCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={openFilesModal} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={PaperclipIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.files.button')}</ButtonText>
            </Button>
            {call?.FileCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.FileCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={openAudioModal} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={Volume2Icon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.audio')}</ButtonText>
            </Button>
            {call?.AudioCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.AudioCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={handleRoute} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={RouteIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('common.route')}</ButtonText>
            </Button>
          </Box>
        </HStack>

        {/* Tabs */}
        <Box className="mx-4 mb-4 mt-3 flex-1 overflow-hidden rounded-xl bg-white pb-8 shadow-xs dark:bg-gray-800">
          <SharedTabs tabs={renderTabs()} variant="underlined" size={isLandscape ? 'md' : 'sm'} />
        </Box>
      </ScrollView>
      <CallNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} callId={callId} />
      <CallImagesModal isOpen={isImagesModalOpen} onClose={() => setIsImagesModalOpen(false)} callId={callId} />
      <CallFilesModal isOpen={isFilesModalOpen} onClose={() => setIsFilesModalOpen(false)} callId={callId} />
      <CallAudioModal isOpen={isAudioModalOpen} onClose={() => setIsAudioModalOpen(false)} callId={callId} />

      {/* Close Call Bottom Sheet */}
      <CloseCallBottomSheet isOpen={isCloseCallModalOpen} onClose={() => setIsCloseCallModalOpen(false)} callId={callId} />

      {/* Reschedule Bottom Sheet */}
      <RescheduleCallSheet isOpen={isRescheduleModalOpen} onClose={() => setIsRescheduleModalOpen(false)} callId={callId} />

      {/* Status Bottom Sheet */}
      <StatusBottomSheet />

      {/* Dispatch additional resources */}
      <DispatchSelectionModal isVisible={isDispatchModalOpen} onClose={() => setIsDispatchModalOpen(false)} onConfirm={handleDispatchAdditional} initialSelection={EMPTY_DISPATCH_SELECTION} />

      {/* Call Detail Menu ActionSheet */}
      <CallDetailActionSheet />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
