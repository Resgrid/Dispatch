import { type Href, router } from 'expo-router';
import { AlertTriangle, ArrowRight, ChevronRight, Clock, CloudLightning, Filter, Info, Mic, Phone, Plus, Radio, Settings, ShieldCheck, Truck, User, Zap } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { CheckInTimerStatus } from '@/models/v4/checkIn/checkInEnums';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { SEVERITY_COLORS, WeatherAlertSeverity } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { useCallsStore } from '@/stores/calls/store';
import { useCheckInStore } from '@/stores/checkIn/store';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';
import { type RadioLogEntry } from '@/stores/dispatch/dispatch-console-store';
import { usePersonnelActionsStore } from '@/stores/dispatch/personnel-actions-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';
import { useWeatherAlertsStore } from '@/stores/weatherAlerts/store';

import { CheckInBottomSheet } from '../checkIn/check-in-bottom-sheet';
import { CheckInTimerCard } from '../checkIn/check-in-timer-card';
import { PanelHeader } from './panel-header';
import { PersonnelActionsPanel } from './personnel-actions-panel';
import { UnitActionsPanel } from './unit-actions-panel';

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  type: 'call' | 'unit' | 'personnel' | 'system';
  action: string;
  description: string;
  metadata?: {
    callId?: string;
    unitId?: string;
    personnelId?: string;
    priority?: string;
  };
}

type TabType = 'activity' | 'radio' | 'actions' | 'checkins' | 'weather';

interface ActivityLogPanelProps {
  entries: ActivityLogEntry[];
  isLoading: boolean;
  onRefresh?: () => void;
  // Debug
  debugId?: string;
  // Call filter props
  isCallFilterActive?: boolean;
  selectedCallId?: string;
  callActivity?: DispatchedEventResultData[];
  onAddUnitEvent?: () => void;
  onAddPersonnelEvent?: () => void;
  // Radio log props
  radioLog?: RadioLogEntry[];
  // Actions props - context-aware actions
  selectedUnitId?: string;
  selectedPersonnelId?: string;
  // Unit data for actions panel
  selectedUnit?: UnitInfoResultData | null;
  onUnitStatusUpdated?: () => void;
  // Personnel data for actions panel
  selectedPersonnel?: PersonnelInfoResultData | null;
  onStatusUpdated?: () => void;
  onStaffingUpdated?: () => void;
  onSetUnitStatus?: () => void;
  onSetPersonnelStatus?: () => void;
  onSetPersonnelStaffing?: () => void;
  onDispatchUnit?: () => void;
  onDispatchPersonnel?: () => void;
  onCreateCall?: () => void;
  onCloseCall?: () => void;
  onViewCallDetails?: () => void;
  onAddCallNote?: () => void;
}

const getIconForType = (type: ActivityLogEntry['type']) => {
  switch (type) {
    case 'call':
      return AlertTriangle;
    case 'unit':
      return Truck;
    case 'personnel':
      return User;
    case 'system':
    default:
      return Info;
  }
};

const getColorForType = (type: ActivityLogEntry['type']) => {
  switch (type) {
    case 'call':
      return '#ef4444';
    case 'unit':
      return '#3b82f6';
    case 'personnel':
      return '#8b5cf6';
    case 'system':
    default:
      return '#6b7280';
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '...';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const ActivityLogItem: React.FC<{ entry: ActivityLogEntry }> = React.memo(({ entry }) => {
  const IconComponent = getIconForType(entry.type);
  const color = getColorForType(entry.type);

  return (
    <HStack className="mb-2 items-start border-b border-gray-100 pb-2 dark:border-gray-800" space="sm">
      <View style={StyleSheet.flatten([styles.iconContainer, { backgroundColor: `${color}20` }])}>
        <Icon as={IconComponent} size="xs" color={color} />
      </View>
      <VStack className="flex-1">
        <HStack className="items-center justify-between">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-100">{entry.action}</Text>
          <HStack className="items-center" space="xs">
            <Icon as={Clock} size="xs" className="text-gray-400" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{formatTime(entry.timestamp)}</Text>
          </HStack>
        </HStack>
        <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={2}>
          {entry.description}
        </Text>
      </VStack>
    </HStack>
  );
});

ActivityLogItem.displayName = 'ActivityLogItem';

const CallActivityItem: React.FC<{ activity: DispatchedEventResultData }> = React.memo(({ activity }) => {
  const getActivityIcon = () => {
    if (activity.Type === 'Unit' || activity.Type === 'u') return Truck;
    if (activity.Type === 'Personnel' || activity.Type === 'p') return User;
    return Info;
  };

  const getActivityColor = () => {
    if (activity.StatusColor) return activity.StatusColor;
    if (activity.Type === 'Unit' || activity.Type === 'u') return '#3b82f6';
    if (activity.Type === 'Personnel' || activity.Type === 'p') return '#8b5cf6';
    return '#6b7280';
  };

  const IconComponent = getActivityIcon();
  const color = getActivityColor();

  return (
    <HStack className="mb-2 items-start border-b border-gray-100 pb-2 dark:border-gray-800" space="sm">
      <View style={StyleSheet.flatten([styles.iconContainer, { backgroundColor: `${color}20` }])}>
        <Icon as={IconComponent} size="xs" color={color} />
      </View>
      <VStack className="flex-1">
        <HStack className="items-center justify-between">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-100">{activity.Name}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{activity.Timestamp}</Text>
        </HStack>
        <HStack className="items-center" space="xs">
          {activity.StatusText ? (
            <Badge size="sm" style={{ backgroundColor: `${color}20` }}>
              <Text style={{ color }} className="text-xs font-medium">
                {activity.StatusText}
              </Text>
            </Badge>
          ) : null}
          {activity.Note ? (
            <Text className="flex-1 text-xs text-gray-600 dark:text-gray-400" numberOfLines={1}>
              {activity.Note}
            </Text>
          ) : null}
        </HStack>
      </VStack>
    </HStack>
  );
});

CallActivityItem.displayName = 'CallActivityItem';

const RadioLogItem: React.FC<{ entry: RadioLogEntry }> = React.memo(({ entry }) => {
  const { t } = useTranslation();
  const color = entry.isActive ? '#22c55e' : '#6b7280';

  return (
    <HStack className="mb-2 items-start border-b border-gray-100 pb-2 dark:border-gray-800" space="sm">
      <View style={StyleSheet.flatten([styles.iconContainer, { backgroundColor: `${color}20` }])}>
        <Icon as={Mic} size="xs" color={color} />
      </View>
      <VStack className="flex-1">
        <HStack className="items-center justify-between">
          <HStack className="items-center" space="xs">
            <Text className="text-xs font-semibold text-gray-800 dark:text-gray-100">{entry.participantName}</Text>
            {entry.isActive ? (
              <Badge size="sm" className="bg-green-100 dark:bg-green-900">
                <Text className="text-xs font-medium text-green-700 dark:text-green-300">{t('dispatch.live')}</Text>
              </Badge>
            ) : null}
          </HStack>
          <HStack className="items-center" space="xs">
            <Icon as={Clock} size="xs" className="text-gray-400" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{formatTime(entry.timestamp)}</Text>
          </HStack>
        </HStack>
        <HStack className="items-center justify-between">
          <Text className="text-xs text-gray-600 dark:text-gray-400">{entry.isActive ? t('dispatch.currently_transmitting') : `${t('dispatch.duration')}: ${formatDuration(entry.duration)}`}</Text>
        </HStack>
      </VStack>
    </HStack>
  );
});

RadioLogItem.displayName = 'RadioLogItem';

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: IconComponent, label, onPress, color = '#3b82f6', disabled = false }) => {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={StyleSheet.flatten([styles.actionButton, disabled && styles.actionButtonDisabled, { borderColor: `${color}40` }])}>
      <VStack className="items-center" space="xs">
        <View style={StyleSheet.flatten([styles.actionIconContainer, { backgroundColor: `${color}20` }])}>
          <Icon as={IconComponent} size="sm" color={disabled ? '#9ca3af' : color} />
        </View>
        <Text className={`text-center text-xs ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`} numberOfLines={2}>
          {label}
        </Text>
      </VStack>
    </Pressable>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  count?: number;
  onPress: () => void;
}> = ({ label, icon: IconComponent, isActive, count, onPress }) => {
  return (
    <Pressable onPress={onPress} style={StyleSheet.flatten([styles.tabButton, isActive && styles.tabButtonActive])}>
      <HStack className="items-center" space="xs">
        <Icon as={IconComponent} size="xs" className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'} />
        <Text className={`text-xs font-medium ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>{label}</Text>
        {count !== undefined && count > 0 ? (
          <View style={StyleSheet.flatten([styles.badge, isActive && styles.badgeActive])}>
            <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </HStack>
    </Pressable>
  );
};

export const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({
  entries,
  isLoading,
  debugId = 'unknown',
  isCallFilterActive,
  selectedCallId,
  callActivity,
  onAddUnitEvent,
  onAddPersonnelEvent,
  radioLog = [],
  selectedUnitId,
  selectedPersonnelId,
  selectedUnit,
  onUnitStatusUpdated,
  selectedPersonnel,
  onStatusUpdated,
  onStaffingUpdated,
  onSetUnitStatus,
  onSetPersonnelStatus,
  onSetPersonnelStaffing,
  onDispatchUnit,
  onDispatchPersonnel,
  onCreateCall,
  onCloseCall,
  onViewCallDetails,
  onAddCallNote,
}) => {
  const { t } = useTranslation();
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('activity-log'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [activeTab, setActiveTab] = useState<TabType>('activity');

  // Personnel actions store
  const { isActionsOpen: isPersonnelActionsOpen, openActions: openPersonnelActions, closeActions: closePersonnelActions } = usePersonnelActionsStore();

  // Unit actions store
  const { isActionsOpen: isUnitActionsOpen, openActions: openUnitActions, closeActions: closeUnitActions } = useUnitActionsStore();

  // Track previous personnel selection to avoid unnecessary store updates
  const prevSelectedPersonnelIdRef = useRef<string | undefined>(undefined);

  // Track previous unit selection to avoid unnecessary store updates
  const prevSelectedUnitIdRef = useRef<string | undefined>(undefined);

  // Track previous call selection to avoid unnecessary tab switches
  const prevSelectedCallIdRef = useRef<string | undefined>(undefined);

  // Reset to activity tab if check-ins tab is active but call filter is cleared
  useEffect(() => {
    if (!isCallFilterActive && activeTab === 'checkins') {
      setActiveTab('activity');
    }
  }, [isCallFilterActive, activeTab]);

  // Switch to actions tab when a call is selected (for quick note/close actions)
  useEffect(() => {
    const prevId = prevSelectedCallIdRef.current;
    const currentId = selectedCallId;

    // Only act if the selection actually changed
    if (prevId !== currentId) {
      prevSelectedCallIdRef.current = currentId;

      if (isCallFilterActive && currentId) {
        setActiveTab('actions'); // Automatically switch to actions tab for call actions
      }
    }
  }, [isCallFilterActive, selectedCallId]);

  // Open actions panel and switch to actions tab when personnel is selected
  useEffect(() => {
    const prevId = prevSelectedPersonnelIdRef.current;
    const currentId = selectedPersonnelId;

    // Only act if the selection actually changed
    if (prevId !== currentId) {
      prevSelectedPersonnelIdRef.current = currentId;

      if (selectedPersonnel && currentId) {
        openPersonnelActions(selectedPersonnel);
        setActiveTab('actions'); // Automatically switch to actions tab
      } else if (prevId && !currentId) {
        // Only close if we had a selection before and now we don't
        closePersonnelActions();
      }
    }
  }, [selectedPersonnel, selectedPersonnelId, openPersonnelActions, closePersonnelActions]);

  // Open actions panel and switch to actions tab when unit is selected
  useEffect(() => {
    const prevId = prevSelectedUnitIdRef.current;
    const currentId = selectedUnitId;

    // Only act if the selection actually changed
    if (prevId !== currentId) {
      prevSelectedUnitIdRef.current = currentId;

      if (selectedUnit && currentId) {
        openUnitActions(selectedUnit);
        setActiveTab('actions'); // Automatically switch to actions tab
      } else if (prevId && !currentId) {
        // Only close if we had a selection before and now we don't
        closeUnitActions();
      }
    }
  }, [selectedUnit, selectedUnitId, openUnitActions, closeUnitActions]);

  // Filter entries when call filter is active
  const filteredEntries = isCallFilterActive && selectedCallId ? entries.filter((entry) => entry.metadata?.callId === selectedCallId || entry.type === 'system') : entries;

  // Determine display mode - use call activity if available when filtering
  const useCallActivity = isCallFilterActive && callActivity && callActivity.length > 0;
  const activityCount = useCallActivity ? callActivity.length : filteredEntries.length;

  // Active transmissions count
  const activeTransmissions = radioLog.filter((entry) => entry.isActive).length;

  // Check-in timers — fetch timer statuses across all active calls
  const calls = useCallsStore((s) => s.calls);
  const { timerStatuses: allTimerStatuses, fetchTimerStatusesForCalls, startPollingForCalls: startCheckInPolling, stopPolling: stopCheckInPolling, isLoadingStatuses: isCheckInsLoading } = useCheckInStore();

  const [isCheckInSheetOpen, setIsCheckInSheetOpen] = useState(false);
  const [checkInSheetCallId, setCheckInSheetCallId] = useState<number>(0);
  const [checkInSheetTimer, setCheckInSheetTimer] = useState<(typeof allTimerStatuses)[0] | null>(null);

  // Get all active call IDs to fetch timer statuses for
  const activeCallIds = useMemo(() => calls.map((c) => parseInt(c.CallId)).filter((id) => !isNaN(id) && id > 0), [calls]);
  // Stable key derived from the ID set (order-independent) so the polling
  // interval only resets when the actual set of active calls changes, not on
  // every SignalR-driven `calls` array identity change.
  const activeCallIdsKey = useMemo(() => [...activeCallIds].sort((a, b) => a - b).join(','), [activeCallIds]);

  useEffect(() => {
    if (activeCallIds.length > 0) {
      fetchTimerStatusesForCalls(activeCallIds);
      startCheckInPolling(activeCallIds);
    }
    return () => {
      stopCheckInPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCallIdsKey, fetchTimerStatusesForCalls, startCheckInPolling, stopCheckInPolling]);

  // When call filter is active, show only timers for the selected call
  const filteredTimerStatuses = useMemo(() => {
    if (!isCallFilterActive || !selectedCallId) return allTimerStatuses;
    const callIdNum = parseInt(selectedCallId);
    if (isNaN(callIdNum)) return allTimerStatuses;
    return allTimerStatuses.filter((s) => s.CallId === callIdNum);
  }, [allTimerStatuses, isCallFilterActive, selectedCallId]);

  const criticalCheckInCount = filteredTimerStatuses.filter((s) => s.Status === CheckInTimerStatus.Critical).length;
  const overdueCheckInCount = filteredTimerStatuses.filter((s) => s.Status === CheckInTimerStatus.Overdue || s.Status === CheckInTimerStatus.Red).length;
  const urgentCheckInCount = criticalCheckInCount + overdueCheckInCount;

  // Weather alerts
  const { alerts: weatherAlerts, settings: weatherSettings } = useWeatherAlertsStore();
  const weatherAlertCount = weatherAlerts.length;

  const handleCheckInFromDashboard = useCallback((timer: (typeof allTimerStatuses)[0]) => {
    setCheckInSheetCallId(timer.CallId);
    setCheckInSheetTimer(timer);
    setIsCheckInSheetOpen(true);
  }, []);

  // Determine what actions are available based on selection context
  const hasSelectedCall = isCallFilterActive && selectedCallId;
  const hasSelectedUnit = !!selectedUnitId;
  const hasSelectedPersonnel = !!selectedPersonnelId;

  const getHeaderTitle = useCallback(() => {
    switch (activeTab) {
      case 'radio':
        return t('dispatch.radio_log');
      case 'actions':
        return t('dispatch.actions');
      case 'checkins':
        return t('dispatch.check_ins');
      case 'weather':
        return t('weatherAlerts.title');
      default:
        return isCallFilterActive ? t('dispatch.call_activity') : t('dispatch.activity_log');
    }
  }, [activeTab, isCallFilterActive, t]);

  const getHeaderCount = useCallback(() => {
    switch (activeTab) {
      case 'radio':
        return radioLog.length;
      case 'actions':
        return urgentCheckInCount > 0 ? urgentCheckInCount : undefined;
      case 'checkins':
        return filteredTimerStatuses.length;
      case 'weather':
        return weatherAlertCount > 0 ? weatherAlertCount : undefined;
      default:
        return activityCount;
    }
  }, [activeTab, radioLog.length, activityCount, filteredTimerStatuses.length, urgentCheckInCount, weatherAlertCount]);

  const renderActivityItem = useCallback(({ item }: { item: ActivityLogEntry }) => <ActivityLogItem entry={item} />, []);
  const activityKeyExtractor = useCallback((item: ActivityLogEntry) => item.id, []);
  const renderRadioItem = useCallback(({ item }: { item: RadioLogEntry }) => <RadioLogItem entry={item} />, []);
  const radioKeyExtractor = useCallback((item: RadioLogEntry) => item.id, []);
  const renderCallActivityItem = useCallback(({ item }: { item: DispatchedEventResultData }) => <CallActivityItem activity={item} />, []);
  const callActivityKeyExtractor = useCallback((item: DispatchedEventResultData, index: number) => `${item.Id || index}-${item.Timestamp}`, []);

  const renderActivityContent = () => {
    if (useCallActivity) {
      // Show call-specific activity from API
      return (
        <FlatList<DispatchedEventResultData>
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          data={callActivity!}
          renderItem={renderCallActivityItem}
          keyExtractor={callActivityKeyExtractor}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      );
    }

    return (
      <FlatList<ActivityLogEntry>
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        data={filteredEntries}
        renderItem={renderActivityItem}
        keyExtractor={activityKeyExtractor}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon as={Info} size="lg" className="text-gray-300 dark:text-gray-600" />
            <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{isCallFilterActive ? t('dispatch.no_call_activity') : t('dispatch.no_activity')}</Text>
          </View>
        }
      />
    );
  };

  const renderRadioContent = () => {
    return (
      <FlatList<RadioLogEntry>
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        data={radioLog}
        renderItem={renderRadioItem}
        keyExtractor={radioKeyExtractor}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon as={Radio} size="lg" className="text-gray-300 dark:text-gray-600" />
            <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('dispatch.no_radio_activity')}</Text>
          </View>
        }
      />
    );
  };

  const renderActionsContent = () => {
    // If personnel is selected, show the personnel actions panel
    if (selectedPersonnel) {
      return <PersonnelActionsPanel personnel={selectedPersonnel} onStatusUpdated={onStatusUpdated} onStaffingUpdated={onStaffingUpdated} />;
    }

    // If unit is selected, show the unit actions panel
    if (selectedUnit) {
      return <UnitActionsPanel unit={selectedUnit} onStatusUpdated={onUnitStatusUpdated} />;
    }

    return (
      <View style={styles.actionsGrid}>
        {/* Call Actions */}
        <VStack className="mb-4" space="xs">
          <Text className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('dispatch.call_actions')}</Text>
          <HStack className="flex-wrap" space="sm">
            {onCreateCall ? <ActionButton icon={Plus} label={t('dispatch.new_call')} onPress={onCreateCall} color="#ef4444" /> : null}
            {onViewCallDetails ? <ActionButton icon={Info} label={t('dispatch.view_details')} onPress={onViewCallDetails} color="#3b82f6" disabled={!hasSelectedCall} /> : null}
            {onAddCallNote ? <ActionButton icon={Plus} label={t('dispatch.add_note')} onPress={onAddCallNote} color="#8b5cf6" disabled={!hasSelectedCall} /> : null}
            {onCloseCall ? <ActionButton icon={AlertTriangle} label={t('dispatch.close_call')} onPress={onCloseCall} color="#f59e0b" disabled={!hasSelectedCall} /> : null}
          </HStack>
        </VStack>

        {/* Unit Actions */}
        <VStack className="mb-4" space="xs">
          <Text className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions')}</Text>
          <HStack className="flex-wrap" space="sm">
            {onSetUnitStatus ? <ActionButton icon={Zap} label={t('dispatch.set_status')} onPress={onSetUnitStatus} color="#3b82f6" disabled={!hasSelectedUnit} /> : null}
            {onDispatchUnit ? <ActionButton icon={Truck} label={t('dispatch.dispatch')} onPress={onDispatchUnit} color="#22c55e" disabled={!hasSelectedUnit || !hasSelectedCall} /> : null}
          </HStack>
        </VStack>

        {/* Personnel Actions */}
        <VStack className="mb-4" space="xs">
          <Text className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('dispatch.personnel_actions.title')}</Text>
          <HStack className="flex-wrap" space="sm">
            {onSetPersonnelStatus ? <ActionButton icon={User} label={t('dispatch.set_status')} onPress={onSetPersonnelStatus} color="#8b5cf6" disabled={!hasSelectedPersonnel} /> : null}
            {onSetPersonnelStaffing ? <ActionButton icon={Settings} label={t('dispatch.set_staffing')} onPress={onSetPersonnelStaffing} color="#6366f1" disabled={!hasSelectedPersonnel} /> : null}
            {onDispatchPersonnel ? <ActionButton icon={Phone} label={t('dispatch.dispatch')} onPress={onDispatchPersonnel} color="#22c55e" disabled={!hasSelectedPersonnel || !hasSelectedCall} /> : null}
          </HStack>
        </VStack>

        {/* Context hint */}
        {!hasSelectedCall && !hasSelectedUnit && !hasSelectedPersonnel ? (
          <Box className="mt-2 flex-row items-center rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <Icon as={Info} size="sm" className="text-amber-500" />
            <Text className="ml-2 flex-1 text-xs text-gray-500 dark:text-gray-400">{t('dispatch.select_items_for_actions')}</Text>
          </Box>
        ) : null}
      </View>
    );
  };

  const renderCheckInsContent = () => {
    if (isCheckInsLoading && filteredTimerStatuses.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</Text>
        </View>
      );
    }

    if (filteredTimerStatuses.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon as={ShieldCheck} size="lg" className="text-gray-300 dark:text-gray-600" />
          <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('check_in.no_timers')}</Text>
        </View>
      );
    }

    return (
      <>
        {/* Summary badges */}
        {urgentCheckInCount > 0 && (
          <HStack className="mb-2 gap-2">
            {criticalCheckInCount > 0 && (
              <Box className="rounded-full bg-red-200 px-2 py-0.5">
                <Text className="text-xs font-bold text-red-700">
                  {criticalCheckInCount} {t('check_in.status_critical')}
                </Text>
              </Box>
            )}
            {overdueCheckInCount > 0 && (
              <Box className="rounded-full bg-red-100 px-2 py-0.5">
                <Text className="text-xs font-medium text-red-600">{t('check_in.overdue_count', { count: overdueCheckInCount })}</Text>
              </Box>
            )}
          </HStack>
        )}

        {filteredTimerStatuses.map((timer) => (
          <CheckInTimerCard key={`${timer.TargetType}-${timer.TargetEntityId}`} timer={timer} onCheckIn={handleCheckInFromDashboard} />
        ))}
      </>
    );
  };

  const renderWeatherContent = () => {
    if (weatherAlerts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon as={CloudLightning} size="lg" className="text-gray-300 dark:text-gray-600" />
          <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('weatherAlerts.noActiveAlerts')}</Text>
        </View>
      );
    }

    return weatherAlerts.map((alert) => {
      const severityColor = SEVERITY_COLORS[alert.Severity] ?? SEVERITY_COLORS[WeatherAlertSeverity.Unknown];
      const itemStyle = StyleSheet.flatten([styles.weatherAlertItem, { borderLeftColor: severityColor }]);
      return (
        <Pressable key={alert.WeatherAlertId} style={itemStyle} onPress={() => router.push(`/(app)/weather-alerts/${alert.WeatherAlertId}` as Href)}>
          <HStack className="items-center justify-between">
            <Text style={{ color: severityColor, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
              {alert.Severity === 0
                ? t('weatherAlerts.severity.extreme')
                : alert.Severity === 1
                  ? t('weatherAlerts.severity.severe')
                  : alert.Severity === 2
                    ? t('weatherAlerts.severity.moderate')
                    : t('weatherAlerts.severity.minor')}
            </Text>
            <Icon as={ChevronRight} size="xs" className="text-gray-400 dark:text-gray-500" />
          </HStack>
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
            {alert.Event}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
            {alert.AreaDescription}
          </Text>
          {alert.ExpiresUtc ? (
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              {t('weatherAlerts.detail.expires')}: {alert.ExpiresUtc}
            </Text>
          ) : null}
        </Pressable>
      );
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'radio':
        return renderRadioContent();
      case 'actions':
        return renderActionsContent();
      case 'checkins':
        return renderCheckInsContent();
      case 'weather':
        return renderWeatherContent();
      default:
        return renderActivityContent();
    }
  };

  const isVirtualizedTab = activeTab === 'activity' || activeTab === 'radio';

  return (
    <Box className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}>
      <PanelHeader
        title={getHeaderTitle()}
        icon={activeTab === 'radio' ? Radio : activeTab === 'actions' ? Settings : activeTab === 'checkins' ? ShieldCheck : activeTab === 'weather' ? CloudLightning : ArrowRight}
        iconColor={activeTab === 'radio' ? '#22c55e' : activeTab === 'actions' ? '#f59e0b' : activeTab === 'checkins' ? '#ef4444' : activeTab === 'weather' ? '#F57C00' : '#6b7280'}
        count={getHeaderCount()}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCardCollapsed('activity-log', !isCollapsed)}
        rightContent={
          isCallFilterActive && activeTab === 'activity' ? (
            <HStack space="xs">
              <Badge size="sm" className="bg-indigo-100 dark:bg-indigo-900">
                <HStack className="items-center" space="xs">
                  <Icon as={Filter} size="xs" className="text-indigo-600 dark:text-indigo-300" />
                  <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{t('dispatch.filtered')}</Text>
                </HStack>
              </Badge>
              {onAddUnitEvent ? (
                <Pressable onPress={onAddUnitEvent} style={styles.iconButton}>
                  <HStack className="items-center" space="xs">
                    <Icon as={Truck} size="xs" className="text-blue-500" />
                    <Icon as={Plus} size="xs" className="text-blue-500" />
                  </HStack>
                </Pressable>
              ) : null}
              {onAddPersonnelEvent ? (
                <Pressable onPress={onAddPersonnelEvent} style={styles.iconButton}>
                  <HStack className="items-center" space="xs">
                    <Icon as={User} size="xs" className="text-purple-500" />
                    <Icon as={Plus} size="xs" className="text-purple-500" />
                  </HStack>
                </Pressable>
              ) : null}
            </HStack>
          ) : null
        }
      />

      {!isCollapsed ? (
        <VStack className="flex-1">
          {/* Tab Bar */}
          <HStack className="border-b border-gray-200 px-2 dark:border-gray-700" space="xs">
            <TabButton label={t('dispatch.activity')} icon={ArrowRight} isActive={activeTab === 'activity'} count={activityCount} onPress={() => setActiveTab('activity')} />
            <TabButton label={t('dispatch.radio')} icon={Radio} isActive={activeTab === 'radio'} count={activeTransmissions > 0 ? activeTransmissions : undefined} onPress={() => setActiveTab('radio')} />
            {isCallFilterActive && (
              <TabButton label={t('dispatch.check_ins')} icon={ShieldCheck} isActive={activeTab === 'checkins'} count={urgentCheckInCount > 0 ? urgentCheckInCount : undefined} onPress={() => setActiveTab('checkins')} />
            )}
            <TabButton label={t('dispatch.actions')} icon={Settings} isActive={activeTab === 'actions'} count={urgentCheckInCount > 0 ? urgentCheckInCount : undefined} onPress={() => setActiveTab('actions')} />
            {weatherSettings?.WeatherAlertsEnabled !== false && (
              <TabButton label={t('weatherAlerts.title')} icon={CloudLightning} isActive={activeTab === 'weather'} count={weatherAlertCount > 0 ? weatherAlertCount : undefined} onPress={() => setActiveTab('weather')} />
            )}
          </HStack>

          {/* Tab Content */}
          {isVirtualizedTab ? (
            renderTabContent()
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
              {renderTabContent()}
            </ScrollView>
          )}
        </VStack>
      ) : null}

      {/* Check-in bottom sheet for performing check-ins from the dashboard */}
      <CheckInBottomSheet
        isOpen={isCheckInSheetOpen}
        onClose={() => {
          setIsCheckInSheetOpen(false);
          setCheckInSheetTimer(null);
        }}
        callId={checkInSheetCallId}
        selectedTimer={checkInSheetTimer}
        timers={allTimerStatuses}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    maxHeight: 350,
  },
  contentContainer: {
    padding: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  iconButton: {
    padding: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 4,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#6366f1',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeActive: {
    backgroundColor: '#6366f1',
  },
  actionsGrid: {
    padding: 4,
  },
  actionButton: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
    marginRight: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherAlertItem: {
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
});
