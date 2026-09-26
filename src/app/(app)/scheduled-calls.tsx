import { type Href, router, Stack, useFocusEffect } from 'expo-router';
import { CalendarClockIcon, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useScheduledCallsStore } from '@/stores/calls/scheduled-store';
import { useCallsStore } from '@/stores/calls/store';

export default function ScheduledCalls() {
  const { scheduledCalls, isLoading, error, fetchScheduledCalls } = useScheduledCallsStore();
  const { fetchCallPriorities, callPriorities } = useCallsStore();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const themedStyles = useMemo(() => getThemedStyles(isDark), [isDark]);

  useFocusEffect(
    useCallback(() => {
      fetchCallPriorities();
      fetchScheduledCalls();
    }, [fetchCallPriorities, fetchScheduledCalls])
  );

  useEffect(() => {
    trackEvent('scheduled_calls_view_rendered', {
      callsCount: scheduledCalls.length,
    });
  }, [trackEvent, scheduledCalls.length]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchScheduledCalls().finally(() => setIsRefreshing(false));
  }, [fetchScheduledCalls]);

  const filteredCalls = scheduledCalls.filter(
    (call) =>
      call.CallId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.Nature?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (call.Name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (call.Address?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (call.Number?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('scheduled_calls.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    if (filteredCalls.length === 0) {
      return <ZeroState heading={t('scheduled_calls.no_scheduled_calls')} description={t('scheduled_calls.no_scheduled_calls_description')} icon={CalendarClockIcon} />;
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
            <RNText style={[styles.headerCell, styles.cellScheduled, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_scheduled')}</RNText>
          </View>

          {/* Table Rows */}
          <FlatList<CallResultData>
            testID="scheduled-calls-list"
            data={filteredCalls}
            renderItem={({ item, index }: { item: CallResultData; index: number }) => {
              const priority = callPriorities.find((p) => p.Id === item.Priority);
              const scheduledDate = formatDateForDisplay(parseDateISOString(item.ScheduledOn || item.ScheduledOnUtc), 'MMM d, yyyy h:mm a');
              const rowBg = { backgroundColor: index % 2 === 0 ? themedStyles.rowEvenBg : themedStyles.rowOddBg };

              return (
                <Pressable onPress={() => router.push(`/call/${item.CallId}` as Href)} style={[styles.tableRow, { borderBottomColor: themedStyles.borderColor }, rowBg]}>
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
                  <View style={[styles.cellScheduled, styles.cellContainer]}>
                    <RNText style={[styles.cellTextScheduled, { color: themedStyles.scheduledColor }]} numberOfLines={1}>
                      {scheduledDate}
                    </RNText>
                  </View>
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
          title: t('scheduled_calls.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <Box className="flex-1 px-4 pt-4">
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('scheduled_calls.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
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
  scheduledColor: isDark ? '#fbbf24' : '#d97706',
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
  cellTextScheduled: {
    fontSize: 13,
    fontWeight: '600',
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
  cellScheduled: {
    width: 160,
  },
});
