import { type Href, router } from 'expo-router';
import { AlertTriangle, Clock, ExternalLink, MapPin, Navigation, Plus, Radio, Search, UserPlus, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';

import { getCallExtraData, updateCall } from '@/api/calls/calls';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { buildAddResourcesUpdateRequest, EMPTY_DISPATCH_SELECTION } from '@/lib/dispatch-helpers';
import { logger } from '@/lib/logging';
import { getTimeAgoUtc, invertColor, isCallActive, stripHtmlTags } from '@/lib/utils';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { CheckInTimerStatus } from '@/models/v4/checkIn/checkInEnums';
import { useCallsStore } from '@/stores/calls/store';
import { useCheckInStore } from '@/stores/checkIn/store';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useSecurityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

import { AnimatedRefreshIcon } from './animated-refresh-icon';
import { PanelHeader } from './panel-header';

// Type → badge appearance
const getDispatchTypeStyle = (type: string): { bg: string; fg: string; label: string } => {
  const t = (type || '').toLowerCase();
  if (t.includes('user') || t.includes('personnel')) return { bg: '#2563eb', fg: '#ffffff', label: 'P' };
  if (t.includes('unit')) return { bg: '#d97706', fg: '#ffffff', label: 'U' };
  if (t.includes('group')) return { bg: '#059669', fg: '#ffffff', label: 'G' };
  if (t.includes('role')) return { bg: '#7c3aed', fg: '#ffffff', label: 'R' };
  return { bg: '#6b7280', fg: '#ffffff', label: '•' };
};

const DispatchBadge: React.FC<{ dispatch: DispatchedEventResultData; isOverdue?: boolean }> = React.memo(({ dispatch, isOverdue }) => {
  const ts = getDispatchTypeStyle(dispatch.Type);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOverdue) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 500, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
        ])
      );
      blink.start();
      return () => blink.stop();
    } else {
      opacity.setValue(1);
    }
  }, [isOverdue, opacity]);

  const bgColor = isOverdue ? '#dc2626' : ts.bg;

  return (
    <Animated.View style={StyleSheet.flatten([styles.dispatchBadge, { backgroundColor: bgColor, opacity }])}>
      <RNText style={StyleSheet.flatten([styles.dispatchBadgeLabel, { color: ts.fg }])}>{ts.label}</RNText>
      <View style={styles.dispatchBadgeDivider} />
      <RNText style={StyleSheet.flatten([styles.dispatchBadgeName, { color: ts.fg }])} numberOfLines={1}>
        {dispatch.Name}
      </RNText>
    </Animated.View>
  );
});

DispatchBadge.displayName = 'DispatchBadge';

// Animated horizontal dispatch ticker with color-coded badges
const DispatchTicker: React.FC<{
  dispatches: DispatchedEventResultData[];
  isLoading?: boolean;
  textColor?: string;
  overdueEntityIds?: Set<string>;
}> = React.memo(({ dispatches, isLoading, textColor = '#ffffff', overdueEntityIds }) => {
  // Deduplicate dispatches by Id (or Type+Name as fallback key)
  const uniqueDispatches = useMemo(() => {
    const seen = new Set<string>();
    return dispatches.filter((d) => {
      const key = d.Id || `${d.Type}:${d.Name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dispatches]);

  const translateX = useRef(new Animated.Value(0)).current;
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startAnim = useCallback(() => {
    if (containerWidthRef.current <= 0 || contentWidthRef.current <= 0) return;
    animRef.current?.stop();
    if (contentWidthRef.current <= containerWidthRef.current) {
      // Content fits – no scrolling needed
      translateX.setValue(0);
      return;
    }
    translateX.setValue(containerWidthRef.current);
    const totalDistance = contentWidthRef.current + containerWidthRef.current;
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -contentWidthRef.current,
        duration: (totalDistance / 60) * 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animRef.current.start();
  }, [translateX]);

  useEffect(() => {
    if (isLoading || uniqueDispatches.length === 0) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    }
    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [isLoading, uniqueDispatches.length]);

  return (
    <View
      style={styles.tickerContainer}
      onLayout={(e) => {
        containerWidthRef.current = e.nativeEvent.layout.width;
        startAnim();
      }}
    >
      {isLoading ? (
        <RNText style={StyleSheet.flatten([styles.tickerPlaceholder, { color: `${textColor}80` }])}>…</RNText>
      ) : uniqueDispatches.length === 0 ? (
        <RNText style={StyleSheet.flatten([styles.tickerPlaceholder, { color: `${textColor}80` }])}>—</RNText>
      ) : (
        <Animated.View style={StyleSheet.flatten([styles.tickerScrollTrack, { transform: [{ translateX }] }])}>
          <View
            style={styles.tickerBadgeRow}
            onLayout={(e) => {
              contentWidthRef.current = e.nativeEvent.layout.width;
              startAnim();
            }}
          >
            {uniqueDispatches.map((d, i) => (
              <React.Fragment key={d.Id || `${d.Type}:${d.Name}`}>
                {i > 0 ? <View style={styles.tickerBadgeGap} /> : null}
                <DispatchBadge dispatch={d} isOverdue={overdueEntityIds?.has(d.Id)} />
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
});

DispatchTicker.displayName = 'DispatchTicker';

// Compact call card optimized for dispatch dashboard
const DashboardCallCard: React.FC<{
  call: CallResultData;
  priority?: CallPriorityResultData;
  dispatches?: DispatchedEventResultData[];
  isLoadingDispatches?: boolean;
  overdueEntityIds?: Set<string>;
}> = React.memo(({ call, priority, dispatches, isLoadingDispatches, overdueEntityIds }) => {
  const bgColor = priority?.Color || '#6b7280';
  const textColor = invertColor(bgColor, true);

  const natureText = useMemo(() => {
    if (!call.Nature) return '';
    return stripHtmlTags(call.Nature).trim();
  }, [call.Nature]);

  const destinationText = useMemo(() => {
    if (!call.DestinationName) return '';
    return call.DestinationTypeName ? `${call.DestinationTypeName}: ${call.DestinationName}` : call.DestinationName;
  }, [call.DestinationName, call.DestinationTypeName]);

  return (
    <View style={StyleSheet.flatten([styles.dashboardCard, { backgroundColor: bgColor }])}>
      {/* Top Row: Priority indicator, Call Number & Time */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdGroup}>
          <View style={StyleSheet.flatten([styles.priorityDot, { backgroundColor: textColor }])} />
          <RNText style={StyleSheet.flatten([styles.cardCallNumber, { color: textColor }])}>#{call.Number}</RNText>
        </View>
        <View style={styles.cardTimeGroup}>
          <Clock size={10} color={textColor} />
          <RNText style={StyleSheet.flatten([styles.cardTimeText, { color: textColor }])}>{getTimeAgoUtc(call.LoggedOnUtc)}</RNText>
        </View>
      </View>

      {/* Call Name - Main Title */}
      <RNText style={StyleSheet.flatten([styles.cardTitle, { color: textColor }])} numberOfLines={1} ellipsizeMode="tail">
        {call.Name}
      </RNText>

      {/* Bottom Row: Location & Nature */}
      <View style={styles.cardDetailsGroup}>
        {call.Address ? (
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailIcon}>
              <MapPin size={10} color={textColor} />
            </View>
            <RNText style={StyleSheet.flatten([styles.cardDetailText, { color: textColor }])} numberOfLines={1} ellipsizeMode="tail">
              {call.Address}
            </RNText>
          </View>
        ) : null}
        {destinationText ? (
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailIcon}>
              <Navigation size={10} color={textColor} />
            </View>
            <RNText style={StyleSheet.flatten([styles.cardDetailText, styles.cardDestinationText, { color: textColor }])} numberOfLines={1} ellipsizeMode="tail">
              {destinationText}
            </RNText>
          </View>
        ) : null}
        {natureText ? (
          <RNText style={StyleSheet.flatten([styles.cardNatureText, { color: textColor }])} numberOfLines={1} ellipsizeMode="tail">
            {natureText}
          </RNText>
        ) : null}
      </View>

      {/* Dispatched Resources Ticker - always visible */}
      <View style={StyleSheet.flatten([styles.tickerDivider, { backgroundColor: `${textColor}40` }])} />
      <View style={styles.tickerRow}>
        <View style={styles.tickerIconWrapper}>
          <Radio size={9} color={textColor} />
        </View>
        <DispatchTicker dispatches={dispatches ?? []} isLoading={isLoadingDispatches} textColor={textColor} overdueEntityIds={overdueEntityIds} />
      </View>
    </View>
  );
});

DashboardCallCard.displayName = 'DashboardCallCard';

interface ActiveCallsPanelProps {
  selectedCallId?: string;
  onSelectCall?: (callId: string) => void;
  isFilterActive?: boolean;
  /** Flex weight when expanded; collapses to header height so siblings absorb the freed space. */
  flexWeight?: number;
}

// Call item wrapper for selection and interaction
const CallItemWrapper: React.FC<{
  call: CallResultData;
  priority?: CallPriorityResultData;
  isSelected: boolean;
  isFilterActive: boolean;
  dispatches?: DispatchedEventResultData[];
  isLoadingDispatches?: boolean;
  overdueEntityIds?: Set<string>;
  onSelect: (callId: string) => void;
  onOpenDetails: (callId: string) => void;
  onDispatchMore?: (call: CallResultData) => void;
}> = React.memo(({ call, priority, isSelected, isFilterActive, dispatches, isLoadingDispatches, overdueEntityIds, onSelect, onOpenDetails, onDispatchMore }) => {
  void isFilterActive; // kept in props for selection badge only
  const { t } = useTranslation();
  const bgColor = priority?.Color || '#6b7280';
  const textColor = invertColor(bgColor, true);

  // Build styles safely to avoid passing false/undefined values on web
  const wrapperStyle = isSelected && isFilterActive ? StyleSheet.flatten([styles.callItemWrapper, styles.selectedCall]) : styles.callItemWrapper;

  return (
    <Pressable onPress={() => onSelect(call.CallId)}>
      <Box style={wrapperStyle}>
        {/* Selection indicator */}
        {isSelected && isFilterActive ? (
          <HStack style={styles.selectionBadgeRow}>
            <Badge size="sm" style={{ backgroundColor: '#6366f1' }}>
              <Text className="text-xs font-semibold text-white">{t('dispatch.active_filter')}</Text>
            </Badge>
          </HStack>
        ) : null}

        {/* Dashboard Card with action button overlay */}
        <View style={styles.cardContainer}>
          <DashboardCallCard call={call} priority={priority} dispatches={dispatches} isLoadingDispatches={isLoadingDispatches} overdueEntityIds={overdueEntityIds} />
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onOpenDetails(call.CallId);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={StyleSheet.flatten([styles.detailsButton, { backgroundColor: `${bgColor}dd` }])}
          >
            <ExternalLink size={12} color={textColor} />
          </Pressable>
          {onDispatchMore ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDispatchMore(call);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={StyleSheet.flatten([styles.dispatchMoreButton, { backgroundColor: `${bgColor}dd` }])}
              testID={`dispatch-more-${call.CallId}`}
            >
              <UserPlus size={12} color={textColor} />
            </Pressable>
          ) : null}
        </View>
      </Box>
    </Pressable>
  );
});

CallItemWrapper.displayName = 'CallItemWrapper';

export const ActiveCallsPanel: React.FC<ActiveCallsPanelProps> = ({ selectedCallId, onSelectCall, isFilterActive = false, flexWeight }) => {
  const { t } = useTranslation();
  const { canUserCreateCalls } = useSecurityStore();
  const showToast = useToastStore((state) => state.showToast);
  const [dispatchTargetCall, setDispatchTargetCall] = useState<CallResultData | null>(null);

  // Check-in timer statuses for overdue detection
  const allTimerStatuses = useCheckInStore((s) => s.timerStatuses);
  const overdueEntityIds = useMemo(() => {
    const ids = new Set<string>();
    allTimerStatuses.forEach((timer) => {
      if (timer.Status === CheckInTimerStatus.Overdue || timer.Status === CheckInTimerStatus.Red || timer.Status === CheckInTimerStatus.Critical) {
        ids.add(timer.TargetEntityId);
      }
    });
    return ids;
  }, [allTimerStatuses]);
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('active-calls'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-call dispatches cache (fetched eagerly for all active calls)
  const [callDispatchesMap, setCallDispatchesMap] = useState<Record<string, DispatchedEventResultData[]>>({});
  const [loadingCallIds, setLoadingCallIds] = useState<Set<string>>(new Set());
  const fetchedCallIdsRef = useRef<Set<string>>(new Set());
  // Per-call epoch tracking: prevents a later batch from silently discarding an
  // earlier in-flight batch while still allowing each call to clear its own
  // loading state independently.
  const callFetchEpochsRef = useRef<Map<string, number>>(new Map());
  const epochCounterRef = useRef(0);

  // Keep selected call's dispatches fresh via dispatch console store (updated by SignalR)
  const selectedCallExtraData = useDispatchConsoleStore((state) => state.selectedCallExtraData);
  useEffect(() => {
    if (selectedCallId && selectedCallExtraData?.Dispatches) {
      setCallDispatchesMap((prev) => ({ ...prev, [selectedCallId]: selectedCallExtraData.Dispatches }));
    }
  }, [selectedCallId, selectedCallExtraData]);

  // Get calls and priorities from the store - use separate selectors for better performance
  const calls = useCallsStore((state) => state.calls);
  const callPriorities = useCallsStore((state) => state.callPriorities);
  const isLoading = useCallsStore((state) => state.isLoadingCalls || state.isLoading);
  const error = useCallsStore((state) => state.callsError || state.error);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);
  const fetchCallPriorities = useCallsStore((state) => state.fetchCallPriorities);

  // Fetch calls and priorities on mount
  useEffect(() => {
    fetchCalls();
    fetchCallPriorities();
  }, [fetchCalls, fetchCallPriorities]);

  // Eagerly fetch dispatches for all active calls not yet fetched
  useEffect(() => {
    const toFetch = calls.filter((c) => isCallActive(c.State) && !fetchedCallIdsRef.current.has(c.CallId)).map((c) => c.CallId);

    if (toFetch.length === 0) return;

    toFetch.forEach((id) => {
      fetchedCallIdsRef.current.add(id);
    });
    setLoadingCallIds((prev) => {
      const next = new Set(prev);
      toFetch.forEach((id) => {
        next.add(id);
      });
      return next;
    });

    // Stamp each callId with its own epoch so a later batch for different
    // callIds does not invalidate these in-flight requests.
    const batchEpochs = new Map<string, number>();
    toFetch.forEach((id) => {
      epochCounterRef.current += 1;
      callFetchEpochsRef.current.set(id, epochCounterRef.current);
      batchEpochs.set(id, epochCounterRef.current);
    });

    const runBatches = async () => {
      // Bound the fan-out so console load does not fire N parallel requests
      const CONCURRENCY = 4;
      for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
        const chunk = toFetch.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map((callId) =>
            getCallExtraData(callId)
              .then((res) => ({ callId, dispatches: res?.Data?.Dispatches ?? ([] as DispatchedEventResultData[]) }))
              .catch(() => ({ callId, dispatches: null as DispatchedEventResultData[] | null }))
          )
        );
        setCallDispatchesMap((prev) => {
          const next = { ...prev };
          results.forEach(({ callId, dispatches }) => {
            // Skip update if a newer request superseded this one for this callId.
            if (callFetchEpochsRef.current.get(callId) !== batchEpochs.get(callId)) return;
            if (dispatches !== null) {
              next[callId] = dispatches;
            } else {
              // Fetch failed – remove from the fetched set so the next refresh can retry
              fetchedCallIdsRef.current.delete(callId);
            }
          });
          return next;
        });
      }
      // Always clear loading state so spinners are never permanently stuck,
      // even if a concurrent batch started after this one.
      setLoadingCallIds((prev) => {
        const next = new Set(prev);
        toFetch.forEach((id) => {
          next.delete(id);
        });
        return next;
      });
    };
    void runBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls]);

  const activeCalls = useMemo(() => {
    // Filter for active or open calls using utility function
    let filtered = calls.filter((c) => isCallActive(c.State));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((c) => {
        const name = (c.Name || '').toLowerCase();
        const nature = (c.Nature || '').toLowerCase();
        const address = (c.Address || '').toLowerCase();
        const type = (c.Type || '').toLowerCase();
        const state = String(c.State ?? '').toLowerCase();
        const callId = (c.Number || '').toLowerCase();
        return name.includes(query) || nature.includes(query) || address.includes(query) || type.includes(query) || state.includes(query) || callId.includes(query);
      });
    }

    return filtered;
  }, [calls, searchQuery]);

  const handleNewCall = useCallback(() => {
    router.push('/call/new/' as Href);
  }, []);

  const getPriority = useCallback(
    (priorityId: number) => {
      return callPriorities.find((p) => p.Id === priorityId);
    },
    [callPriorities]
  );

  const handleOpenCallDetails = useCallback((callId: string) => {
    router.push(`/call/${callId}` as Href);
  }, []);

  const handleSelectCall = useCallback(
    (callId: string) => {
      onSelectCall?.(callId);
    },
    [onSelectCall]
  );

  const handleDispatchMore = useCallback((call: CallResultData) => {
    setDispatchTargetCall(call);
  }, []);

  // Dispatch additional resources to the targeted call. Picked resources are unioned with the call's
  // existing dispatches so nothing is un-dispatched; the server notifies only the newly-added resources.
  const handleDispatchAdditional = async (selection: DispatchSelection) => {
    const call = dispatchTargetCall;
    if (!call) return;

    try {
      // Load the latest dispatch snapshot immediately before building the request so we
      // union against current server state. A stale or not-yet-fetched cached list would
      // drop existing dispatches and un-dispatch those resources on updateCall.
      const latest = await getCallExtraData(call.CallId).catch(() => null);
      if (!latest?.Data) {
        // Couldn't confirm the current dispatch list — abort rather than risk overwriting
        // server state with an incomplete DispatchList.
        showToast('error', t('call_detail.dispatch_more_error'));
        return;
      }

      await updateCall(buildAddResourcesUpdateRequest(call, latest.Data.Dispatches, selection, latest.Data.CallFormData));

      // Refresh this call's dispatches so the resource ticker reflects the new assignment.
      const res = await getCallExtraData(call.CallId).catch(() => null);
      if (res?.Data?.Dispatches) {
        setCallDispatchesMap((prev) => ({ ...prev, [call.CallId]: res.Data.Dispatches }));
      }

      showToast('success', t('call_detail.dispatch_more_success'));
    } catch (error) {
      logger.error({ message: 'Failed to dispatch additional resources', context: { error, callId: call.CallId } });
      showToast('error', t('call_detail.dispatch_more_error'));
    }
  };

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Invalidate all in-flight per-call requests by wiping the epoch map;
    // any in-flight batch's batchEpochs values will no longer match, so
    // stale results won't be written back to callDispatchesMap.
    callFetchEpochsRef.current = new Map();
    // Clear tracking state so all active calls get their dispatches re-fetched
    fetchedCallIdsRef.current = new Set();
    setLoadingCallIds(new Set());
    fetchCalls();
    fetchCallPriorities();
  }, [fetchCalls, fetchCallPriorities]);

  const renderCallItem = useCallback(
    ({ item }: { item: CallResultData }) => (
      <CallItemWrapper
        call={item}
        priority={getPriority(item.Priority)}
        isSelected={selectedCallId === item.CallId}
        isFilterActive={isFilterActive}
        dispatches={callDispatchesMap[item.CallId]}
        isLoadingDispatches={loadingCallIds.has(item.CallId)}
        overdueEntityIds={overdueEntityIds}
        onSelect={handleSelectCall}
        onOpenDetails={handleOpenCallDetails}
        onDispatchMore={canUserCreateCalls ? handleDispatchMore : undefined}
      />
    ),
    [getPriority, selectedCallId, isFilterActive, callDispatchesMap, loadingCallIds, overdueEntityIds, handleSelectCall, handleOpenCallDetails, canUserCreateCalls, handleDispatchMore]
  );

  const keyExtractor = useCallback((item: CallResultData) => item.CallId, []);

  return (
    <Box
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}
      style={!isCollapsed && flexWeight !== undefined ? { flex: flexWeight } : undefined}
    >
      <PanelHeader
        title={t('dispatch.active_calls')}
        icon={AlertTriangle}
        iconColor="#ef4444"
        count={activeCalls.length}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCardCollapsed('active-calls', !isCollapsed)}
        rightContent={
          <HStack space="xs">
            <Pressable onPress={handleRefresh} style={styles.iconButton}>
              <AnimatedRefreshIcon isLoading={isLoading} />
            </Pressable>
            {canUserCreateCalls ? (
              <Pressable onPress={handleNewCall} style={styles.iconButton}>
                <Icon as={Plus} size="xs" className="text-indigo-500" />
              </Pressable>
            ) : null}
          </HStack>
        }
      />

      {!isCollapsed ? (
        <View style={styles.contentWrapper}>
          {/* Search Input */}
          <HStack className="items-center border-b border-gray-200 px-2 py-1.5 dark:border-gray-700" space="sm">
            <Icon as={Search} size="xs" className="text-gray-400" />
            <TextInput
              style={styles.searchInput}
              className="flex-1 text-sm text-gray-800 dark:text-gray-100"
              placeholder={t('dispatch.search_calls_placeholder')}
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Icon as={X} size="xs" className="text-gray-400" />
              </Pressable>
            ) : null}
          </HStack>
          {error ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.emptyState}>
                <Icon as={AlertTriangle} size="lg" className="text-red-400" />
                <Text className="mt-2 text-center text-sm text-red-500">{error}</Text>
                <Pressable onPress={handleRefresh} style={styles.retryButton}>
                  <Text className="text-sm text-indigo-500">{t('common.retry')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <FlatList<CallResultData>
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              data={activeCalls}
              renderItem={renderCallItem}
              keyExtractor={keyExtractor}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews={Platform.OS !== 'web'}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon as={AlertTriangle} size="lg" className="text-gray-300 dark:text-gray-600" />
                  <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('dispatch.no_active_calls')}</Text>
                </View>
              }
            />
          )}
        </View>
      ) : null}

      {/* Dispatch additional resources — RN Modal portals above the panel's overflow-hidden container. */}
      <Modal visible={!!dispatchTargetCall} transparent animationType="slide" onRequestClose={() => setDispatchTargetCall(null)}>
        <DispatchSelectionModal isVisible={!!dispatchTargetCall} onClose={() => setDispatchTargetCall(null)} onConfirm={handleDispatchAdditional} initialSelection={EMPTY_DISPATCH_SELECTION} />
      </Modal>
    </Box>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  content: {
    flex: 1,
    maxHeight: 300,
  },
  contentContainer: {
    padding: 8,
  },
  callItemWrapper: {
    marginBottom: 8,
  },
  selectedCall: {
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 10,
    padding: 4,
  },
  selectionBadgeRow: {
    marginBottom: 4,
  },
  cardContainer: {
    position: 'relative',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  retryButton: {
    marginTop: 8,
    padding: 8,
  },
  iconButton: {
    padding: 4,
  },
  detailsButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
    borderRadius: 4,
  },
  dispatchMoreButton: {
    position: 'absolute',
    top: 6,
    right: 34,
    padding: 4,
    borderRadius: 4,
  },
  // Dashboard Card Styles
  dashboardCard: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardCallNumber: {
    fontSize: 11,
    fontWeight: '700' as const,
    marginLeft: 6,
  },
  cardTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 52, // Space for the details + dispatch-more buttons
  },
  cardTimeText: {
    fontSize: 10,
    marginLeft: 3,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  cardDetailsGroup: {
    marginTop: 2,
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetailIcon: {
    marginRight: 4,
  },
  cardDetailText: {
    fontSize: 10,
    flex: 1,
  },
  cardDestinationText: {
    fontWeight: '600' as const,
  },
  cardNatureText: {
    fontSize: 10,
    fontStyle: 'italic' as const,
    paddingLeft: 14,
  },
  // Dispatch ticker styles
  tickerDivider: {
    height: 1,
    marginTop: 6,
    marginBottom: 5,
    marginHorizontal: -10,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tickerIconWrapper: {
    marginRight: 5,
    flexShrink: 0,
  },
  tickerContainer: {
    flex: 1,
    overflow: 'hidden',
    height: 18,
    justifyContent: 'center',
  },
  tickerScrollTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerBadgeGap: {
    width: 5,
  },
  tickerPlaceholder: {
    fontSize: 9,
    fontStyle: 'italic' as const,
  },
  // Dispatch badge pill
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 3,
    overflow: 'hidden',
    height: 14,
  },
  dispatchBadgeLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    paddingHorizontal: 3,
    opacity: 1,
  },
  dispatchBadgeDivider: {
    width: 1,
    height: '100%' as unknown as number,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dispatchBadgeName: {
    fontSize: 9,
    fontWeight: '500' as const,
    paddingHorizontal: 4,
  },
});
