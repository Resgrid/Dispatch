import { type Href, router, Stack, useFocusEffect } from 'expo-router';
import { HourglassIcon, Search, SendIcon, X, XCircleIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { useCallDispatchNow } from '@/components/calls/use-call-dispatch-now';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { usePendingCallsStore } from '@/stores/calls/pending-store';
import { useCallsStore } from '@/stores/calls/store';
import { useSecurityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/**
 * Calls saved as Pending ("to be dispatched"): numbered, nobody notified, not on the field apps. A
 * dispatcher picks one up here, chooses who to send and dispatches it, or cancels it.
 */
export default function PendingCalls() {
  const pendingCalls = usePendingCallsStore((s) => s.pendingCalls);
  const isLoading = usePendingCallsStore((s) => s.isLoading);
  const error = usePendingCallsStore((s) => s.error);
  const fetchPendingCalls = usePendingCallsStore((s) => s.fetchPendingCalls);
  const callPriorities = useCallsStore((s) => s.callPriorities);
  const fetchCallPriorities = useCallsStore((s) => s.fetchCallPriorities);
  const lastCallsUpdateTimestamp = useSignalRStore((s) => s.lastCallsUpdateTimestamp);
  const { canUserCreateCalls } = useSecurityStore();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const themedStyles = useMemo(() => getThemedStyles(isDark), [isDark]);
  const { openDispatchPicker, confirmCancelPending, busyCallId, dispatchPicker } = useCallDispatchNow();

  useFocusEffect(
    useCallback(() => {
      fetchCallPriorities();
      fetchPendingCalls();
    }, [fetchCallPriorities, fetchPendingCalls])
  );

  // A pending call created, edited, dispatched or cancelled anywhere arrives as a calls push; keep the
  // list current while it is on screen. The store collapses overlapping refreshes into one.
  const prevCallsTimestamp = useRef(lastCallsUpdateTimestamp);
  useEffect(() => {
    if (lastCallsUpdateTimestamp > 0 && lastCallsUpdateTimestamp !== prevCallsTimestamp.current) {
      prevCallsTimestamp.current = lastCallsUpdateTimestamp;
      fetchPendingCalls();
    }
  }, [lastCallsUpdateTimestamp, fetchPendingCalls]);

  useEffect(() => {
    trackEvent('pending_calls_view_rendered', {
      callsCount: pendingCalls.length,
    });
  }, [trackEvent, pendingCalls.length]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPendingCalls().finally(() => setIsRefreshing(false));
  }, [fetchPendingCalls]);

  const priorityById = useMemo(() => {
    const map = new Map<number, (typeof callPriorities)[number]>();
    callPriorities.forEach((p) => map.set(p.Id, p));
    return map;
  }, [callPriorities]);

  const filteredCalls = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pendingCalls.filter(
      (call) =>
        call.CallId.toLowerCase().includes(query) ||
        (call.Nature?.toLowerCase() || '').includes(query) ||
        (call.Name?.toLowerCase() || '').includes(query) ||
        (call.Address?.toLowerCase() || '').includes(query) ||
        (call.Number?.toLowerCase() || '').includes(query)
    );
  }, [pendingCalls, searchQuery]);

  const renderContent = () => {
    // Only the first load replaces the table; a refresh from a push keeps the rows on screen.
    if (isLoading && pendingCalls.length === 0) {
      return <Loading text={t('pending_calls.loading')} />;
    }

    if (error && pendingCalls.length === 0) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    if (filteredCalls.length === 0) {
      return <ZeroState heading={t('pending_calls.no_pending_calls')} description={t('pending_calls.no_pending_calls_description')} icon={HourglassIcon} />;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Table Header */}
          <View style={[styles.tableHeader, { backgroundColor: themedStyles.headerBg, borderBottomColor: themedStyles.borderColor }]}>
            <RNText style={[styles.headerCell, styles.cellNumber, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_number')}</RNText>
            <RNText style={[styles.headerCell, styles.cellName, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_name')}</RNText>
            <RNText style={[styles.headerCell, styles.cellType, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_type')}</RNText>
            <RNText style={[styles.headerCell, styles.cellPriority, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_priority')}</RNText>
            <RNText style={[styles.headerCell, styles.cellAddress, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_address')}</RNText>
            <RNText style={[styles.headerCell, styles.cellReceived, { color: themedStyles.headerTextColor }]}>{t('pending_calls.table_received')}</RNText>
            {canUserCreateCalls ? <RNText style={[styles.headerCell, styles.cellActions, { color: themedStyles.headerTextColor }]}>{t('dispatch.actions')}</RNText> : null}
          </View>

          {/* Table Rows */}
          <FlatList<CallResultData>
            testID="pending-calls-list"
            data={filteredCalls}
            renderItem={({ item, index }: { item: CallResultData; index: number }) => {
              const priority = priorityById.get(item.Priority);
              const receivedDate = formatDateForDisplay(parseDateISOString(item.LoggedOn), 'MMM dd, yyyy hh:mm t');
              const rowBg = { backgroundColor: index % 2 === 0 ? themedStyles.rowEvenBg : themedStyles.rowOddBg };
              const isBusy = busyCallId === item.CallId;

              return (
                <Pressable onPress={() => router.push(`/call/${item.CallId}` as Href)} style={[styles.tableRow, { borderBottomColor: themedStyles.borderColor }, rowBg]} testID={`pending-call-row-${item.CallId}`}>
                  <View style={[styles.cellNumber, styles.cellContainer]}>
                    <RNText style={[styles.cellTextBold, { color: themedStyles.textPrimary }]} numberOfLines={1}>
                      {item.Number || item.CallId}
                    </RNText>
                  </View>
                  <View style={[styles.cellName, styles.cellContainer]}>
                    <RNText style={[styles.cellText, { color: themedStyles.textPrimary }]} numberOfLines={1}>
                      {item.Name}
                    </RNText>
                  </View>
                  <View style={[styles.cellType, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {item.Type || '-'}
                    </RNText>
                  </View>
                  <View style={[styles.cellPriority, styles.cellContainer]}>
                    <View style={styles.priorityBadge}>
                      <View style={[styles.priorityDot, { backgroundColor: priority?.Color || '#6b7280' }]} />
                      <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                        {priority?.Name || '-'}
                      </RNText>
                    </View>
                  </View>
                  <View style={[styles.cellAddress, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {item.Address || '-'}
                    </RNText>
                  </View>
                  <View style={[styles.cellReceived, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {receivedDate || '-'}
                    </RNText>
                  </View>
                  {canUserCreateCalls ? (
                    <View style={[styles.cellActions, styles.actionsRow]}>
                      {isBusy ? (
                        <ActivityIndicator size="small" color={themedStyles.dispatchColor} />
                      ) : (
                        <>
                          <Pressable
                            onPress={() => void openDispatchPicker(item.CallId)}
                            style={[styles.actionButton, { backgroundColor: themedStyles.dispatchColor }]}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('dispatch.dispatch')} ${item.Number || item.CallId}`}
                            testID={`pending-call-dispatch-${item.CallId}`}
                          >
                            <SendIcon size={14} color="#ffffff" />
                            <RNText style={styles.actionButtonText}>{t('dispatch.dispatch')}</RNText>
                          </Pressable>
                          <Pressable
                            onPress={() => confirmCancelPending(item.CallId)}
                            style={[styles.actionButton, styles.actionButtonOutline, { borderColor: themedStyles.cancelColor }]}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('pending_calls.cancel_call')} ${item.Number || item.CallId}`}
                            testID={`pending-call-cancel-${item.CallId}`}
                          >
                            <XCircleIcon size={14} color={themedStyles.cancelColor} />
                            <RNText style={[styles.actionButtonText, { color: themedStyles.cancelColor }]}>{t('pending_calls.cancel_call')}</RNText>
                          </Pressable>
                        </>
                      )}
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
            keyExtractor={(item: CallResultData) => item.CallId}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </ScrollView>
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('pending_calls.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <Box className="flex-1 px-4 pt-4">
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('pending_calls.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
      {dispatchPicker}
    </View>
  );
}

const getThemedStyles = (isDark: boolean) => ({
  headerBg: isDark ? '#1f2937' : '#f9fafb',
  borderColor: isDark ? '#374151' : '#e5e7eb',
  headerTextColor: isDark ? '#9ca3af' : '#6b7280',
  rowEvenBg: isDark ? '#111827' : '#ffffff',
  rowOddBg: isDark ? '#1f2937' : '#f9fafb',
  textPrimary: isDark ? '#f3f4f6' : '#111827',
  textSecondary: isDark ? '#d1d5db' : '#4b5563',
  dispatchColor: isDark ? '#3b82f6' : '#2563eb',
  cancelColor: isDark ? '#f87171' : '#dc2626',
});

const styles = StyleSheet.create({
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellContainer: {
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cellTextBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellTextSecondary: {
    fontSize: 13,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  cellNumber: {
    width: 80,
  },
  cellName: {
    width: 160,
  },
  cellType: {
    width: 100,
  },
  cellPriority: {
    width: 100,
  },
  cellAddress: {
    width: 180,
  },
  cellReceived: {
    width: 160,
  },
  cellActions: {
    width: 240,
  },
});
