import { type Href, router, Stack, useFocusEffect } from 'expo-router';
import { ArchiveIcon, FilterIcon, PlusIcon, RefreshCwIcon, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { DateTimeField } from '@/components/common/date-time-field';
import { Loading } from '@/components/common/loading';
import { TypeIcon } from '@/components/common/type-icon';
import ZeroState from '@/components/common/zero-state';
import { OptionSelect } from '@/components/operations/option-select';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { useAnalytics } from '@/hooks/use-analytics';
import { ARCHIVED_CALL_STATES, type ArchivedCallFilters, archivedCallStateLabelKey, archivedCallTypes, countActiveArchivedCallFilters, EMPTY_ARCHIVED_CALL_FILTERS, filterArchivedCalls } from '@/lib/archived-calls';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useArchivedCallsStore } from '@/stores/calls/archived-store';
import { useCallsStore } from '@/stores/calls/store';
import { useSecurityStore } from '@/stores/security/store';

const DATE_FORMAT = 'MMM dd, yyyy hh:mm t';

/** How long a loaded year counts as current when the screen comes back into view. */
const ARCHIVED_CALLS_FRESH_MS = 60 * 1000;

const toggled = <T,>(values: T[], value: T): T[] => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

const FilterChip: React.FC<{ label: string; active: boolean; onPress: () => void; testID: string; color?: string }> = ({ label, active, onPress, testID, color }) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    className={`flex-row items-center rounded-full border px-3 py-1 ${active ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}
  >
    {color ? <View style={[styles.priorityDot, styles.chipDot, { backgroundColor: color }]} /> : null}
    <RNText className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{label}</RNText>
  </Pressable>
);

/**
 * Archived calls: the department's closed calls, a year at a time, with search and filters, and the way in to
 * entering a call that already happened (Add Archived Call).
 */
export default function ArchivedCalls() {
  const years = useArchivedCallsStore((s) => s.years);
  const selectedYear = useArchivedCallsStore((s) => s.selectedYear);
  const archivedCalls = useArchivedCallsStore((s) => s.archivedCalls);
  const isLoading = useArchivedCallsStore((s) => s.isLoading);
  const error = useArchivedCallsStore((s) => s.error);
  const load = useArchivedCallsStore((s) => s.load);
  const selectYear = useArchivedCallsStore((s) => s.selectYear);
  const fetchArchivedCalls = useArchivedCallsStore((s) => s.fetchArchivedCalls);
  const callPriorities = useCallsStore((s) => s.callPriorities);
  const fetchCallPriorities = useCallsStore((s) => s.fetchCallPriorities);
  const { canUserCreateCalls } = useSecurityStore();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [filters, setFilters] = useState<ArchivedCallFilters>(EMPTY_ARCHIVED_CALL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const themedStyles = useMemo(() => getThemedStyles(isDark), [isDark]);

  useFocusEffect(
    useCallback(() => {
      fetchCallPriorities();
      // Archived calls rarely change: coming back from a call reuses the year loaded a moment ago. A call just added
      // (the store's showYear) or a refresh always loads.
      if (Date.now() - useArchivedCallsStore.getState().lastFetched > ARCHIVED_CALLS_FRESH_MS) {
        void load();
      }
    }, [fetchCallPriorities, load])
  );

  useEffect(() => {
    trackEvent('archived_calls_view_rendered', {
      callsCount: archivedCalls.length,
      year: selectedYear ?? '',
    });
  }, [trackEvent, archivedCalls.length, selectedYear]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchArchivedCalls().finally(() => setIsRefreshing(false));
  }, [fetchArchivedCalls]);

  const priorityById = useMemo(() => {
    const map = new Map<number, (typeof callPriorities)[number]>();
    callPriorities.forEach((p) => map.set(p.Id, p));
    return map;
  }, [callPriorities]);

  const yearOptions = useMemo(() => years.map((year) => ({ value: year, label: year })), [years]);
  const callTypes = useMemo(() => archivedCallTypes(archivedCalls), [archivedCalls]);
  const filteredCalls = useMemo(() => filterArchivedCalls(archivedCalls, filters), [archivedCalls, filters]);
  const activeFilterCount = countActiveArchivedCallFilters(filters);
  const isFiltered = activeFilterCount > 0 || filters.query.trim().length > 0;

  const updateFilters = (changes: Partial<ArchivedCallFilters>) => setFilters((current) => ({ ...current, ...changes }));

  const renderFilters = () => (
    <View style={[styles.filterPanel, { backgroundColor: themedStyles.panelBg, borderColor: themedStyles.borderColor }]} testID="archived-calls-filters">
      <RNText style={[styles.filterLabel, { color: themedStyles.headerTextColor }]}>{t('archived_calls.table_state')}</RNText>
      <View style={styles.chipRow}>
        {ARCHIVED_CALL_STATES.map((state) => (
          <FilterChip
            key={state.value}
            label={t(state.labelKey)}
            active={filters.states.includes(state.value)}
            onPress={() => updateFilters({ states: toggled(filters.states, state.value) })}
            testID={`archived-filter-state-${state.value}`}
          />
        ))}
      </View>

      {callPriorities.length > 0 ? (
        <>
          <RNText style={[styles.filterLabel, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_priority')}</RNText>
          <View style={styles.chipRow}>
            {callPriorities.map((priority) => (
              <FilterChip
                key={priority.Id}
                label={priority.Name}
                color={priority.Color}
                active={filters.priorities.includes(priority.Id)}
                onPress={() => updateFilters({ priorities: toggled(filters.priorities, priority.Id) })}
                testID={`archived-filter-priority-${priority.Id}`}
              />
            ))}
          </View>
        </>
      ) : null}

      {callTypes.length > 0 ? (
        <>
          <RNText style={[styles.filterLabel, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_type')}</RNText>
          <View style={styles.chipRow}>
            {callTypes.map((type) => (
              <FilterChip key={type} label={type} active={filters.types.includes(type)} onPress={() => updateFilters({ types: toggled(filters.types, type) })} testID={`archived-filter-type-${type}`} />
            ))}
          </View>
        </>
      ) : null}

      <RNText style={[styles.filterLabel, { color: themedStyles.headerTextColor }]}>{t('archived_calls.logged_between')}</RNText>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <DateTimeField value={filters.fromDate} onChange={(fromDate) => updateFilters({ fromDate })} label={t('archived_calls.from_date')} mode="date" testID="archived-filter-from" />
        </View>
        <View style={styles.dateField}>
          <DateTimeField value={filters.toDate} onChange={(toDate) => updateFilters({ toDate })} label={t('archived_calls.to_date')} mode="date" testID="archived-filter-to" />
        </View>
      </View>

      {activeFilterCount > 0 ? (
        <Pressable onPress={() => setFilters((current) => ({ ...EMPTY_ARCHIVED_CALL_FILTERS, query: current.query }))} accessibilityRole="button" testID="archived-filters-clear" style={styles.clearFilters}>
          <RNText style={[styles.clearFiltersText, { color: themedStyles.linkColor }]}>{t('archived_calls.clear_filters')}</RNText>
        </Pressable>
      ) : null}
    </View>
  );

  const renderContent = () => {
    // Only the first load replaces the table; a refresh keeps the rows on screen.
    if (isLoading && archivedCalls.length === 0) {
      return <Loading text={t('archived_calls.loading')} />;
    }

    if (error && archivedCalls.length === 0) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    if (archivedCalls.length === 0) {
      return <ZeroState heading={t('archived_calls.no_archived_calls')} description={t('archived_calls.no_archived_calls_description', { year: selectedYear ?? '' })} icon={ArchiveIcon} />;
    }

    if (filteredCalls.length === 0) {
      return <ZeroState heading={t('archived_calls.no_matches')} description={t('archived_calls.no_matches_description')} icon={Search} />;
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
            <RNText style={[styles.headerCell, styles.cellState, { color: themedStyles.headerTextColor }]}>{t('archived_calls.table_state')}</RNText>
            <RNText style={[styles.headerCell, styles.cellAddress, { color: themedStyles.headerTextColor }]}>{t('scheduled_calls.table_address')}</RNText>
            <RNText style={[styles.headerCell, styles.cellDate, { color: themedStyles.headerTextColor }]}>{t('archived_calls.table_logged')}</RNText>
            <RNText style={[styles.headerCell, styles.cellDate, { color: themedStyles.headerTextColor }]}>{t('archived_calls.table_closed')}</RNText>
          </View>

          {/* Table Rows */}
          <FlatList<CallResultData>
            testID="archived-calls-list"
            data={filteredCalls}
            renderItem={({ item, index }: { item: CallResultData; index: number }) => {
              const priority = priorityById.get(item.Priority);
              const stateLabelKey = archivedCallStateLabelKey(item.State);
              const loggedOn = formatDateForDisplay(parseDateISOString(item.LoggedOn), DATE_FORMAT);
              const closedOn = formatDateForDisplay(parseDateISOString(item.ClosedOn), DATE_FORMAT);
              const rowBg = { backgroundColor: index % 2 === 0 ? themedStyles.rowEvenBg : themedStyles.rowOddBg };

              return (
                <Pressable onPress={() => router.push(`/call/${item.CallId}` as Href)} style={[styles.tableRow, { borderBottomColor: themedStyles.borderColor }, rowBg]} testID={`archived-call-row-${item.CallId}`}>
                  <View style={[styles.cellNumber, styles.cellContainer]}>
                    <RNText style={[styles.cellTextBold, { color: themedStyles.textPrimary }]} numberOfLines={1}>
                      {item.Number || item.CallId}
                    </RNText>
                  </View>
                  <View style={[styles.cellName, styles.cellContainer]}>
                    <RNText style={[styles.cellText, { color: themedStyles.textPrimary }]} numberOfLines={1}>
                      {item.Name}
                    </RNText>
                    {item.Nature ? (
                      <RNText style={[styles.cellTextMuted, { color: themedStyles.textMuted }]} numberOfLines={1}>
                        {item.Nature}
                      </RNText>
                    ) : null}
                  </View>
                  <View style={[styles.cellType, styles.cellContainer]}>
                    <View style={styles.typeBadge}>
                      <TypeIcon iconUrl={item.TypeIconUrl} mapIcon={item.TypeMapIcon} size={16} />
                      <RNText style={[styles.cellTextSecondary, styles.typeText, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                        {item.Type || '-'}
                      </RNText>
                    </View>
                  </View>
                  <View style={[styles.cellPriority, styles.cellContainer]}>
                    <View style={styles.priorityBadge}>
                      <View style={[styles.priorityDot, { backgroundColor: priority?.Color || '#6b7280' }]} />
                      <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                        {priority?.Name || '-'}
                      </RNText>
                    </View>
                  </View>
                  <View style={[styles.cellState, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {stateLabelKey ? t(stateLabelKey) : '-'}
                    </RNText>
                  </View>
                  <View style={[styles.cellAddress, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {item.Address || '-'}
                    </RNText>
                  </View>
                  <View style={[styles.cellDate, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {loggedOn || '-'}
                    </RNText>
                  </View>
                  <View style={[styles.cellDate, styles.cellContainer]}>
                    <RNText style={[styles.cellTextSecondary, { color: themedStyles.textSecondary }]} numberOfLines={1}>
                      {closedOn || '-'}
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
          title: t('archived_calls.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <Box className="flex-1 px-4 pt-4">
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Input className="rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
              <InputSlot className="pl-3">
                <InputIcon as={Search} />
              </InputSlot>
              <InputField placeholder={t('archived_calls.search')} value={filters.query} onChangeText={(query: string) => updateFilters({ query })} />
              {filters.query ? (
                <InputSlot className="pr-3" onPress={() => updateFilters({ query: '' })}>
                  <InputIcon as={X} />
                </InputSlot>
              ) : null}
            </Input>
          </View>

          <View style={styles.yearSelect}>
            {/* Keyed by the year: the store picks one after the years load, and the select only shows the label it started with. */}
            <OptionSelect
              key={selectedYear ?? ''}
              value={selectedYear ?? ''}
              options={yearOptions}
              placeholder={t('archived_calls.year')}
              onChange={(year) => void selectYear(year)}
              isDisabled={years.length === 0}
              testID="archived-calls-year"
            />
          </View>

          <Pressable
            onPress={() => setShowFilters((shown) => !shown)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFilters }}
            accessibilityLabel={t('archived_calls.filters')}
            testID="archived-calls-filters-toggle"
            style={[styles.toolbarButton, { borderColor: themedStyles.borderColor, backgroundColor: showFilters || activeFilterCount > 0 ? themedStyles.activeButtonBg : themedStyles.panelBg }]}
          >
            <FilterIcon size={16} color={themedStyles.textSecondary} />
            <RNText style={[styles.toolbarButtonText, { color: themedStyles.textSecondary }]}>{activeFilterCount > 0 ? `${t('archived_calls.filters')} (${activeFilterCount})` : t('archived_calls.filters')}</RNText>
          </Pressable>

          <Pressable
            onPress={handleRefresh}
            disabled={isLoading || !selectedYear}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            testID="archived-calls-refresh"
            style={[styles.toolbarButton, { borderColor: themedStyles.borderColor, backgroundColor: themedStyles.panelBg }]}
          >
            <RefreshCwIcon size={16} color={themedStyles.textSecondary} />
          </Pressable>

          {canUserCreateCalls ? (
            <Pressable
              onPress={() => router.push('/call/new/archived' as Href)}
              accessibilityRole="button"
              testID="archived-calls-add"
              style={[styles.toolbarButton, styles.addButton, { backgroundColor: themedStyles.addColor, borderColor: themedStyles.addColor }]}
            >
              <PlusIcon size={16} color="#ffffff" />
              <RNText style={[styles.toolbarButtonText, styles.addButtonText]}>{t('archived_calls.add')}</RNText>
            </Pressable>
          ) : null}
        </View>

        {showFilters ? renderFilters() : null}

        {archivedCalls.length > 0 && isFiltered ? (
          <RNText style={[styles.resultCount, { color: themedStyles.textMuted }]} testID="archived-calls-count">
            {t('archived_calls.showing', { count: filteredCalls.length, total: archivedCalls.length })}
          </RNText>
        ) : null}

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
  textMuted: isDark ? '#9ca3af' : '#6b7280',
  panelBg: isDark ? '#1f2937' : '#ffffff',
  activeButtonBg: isDark ? '#1e3a8a' : '#dbeafe',
  linkColor: isDark ? '#60a5fa' : '#2563eb',
  addColor: isDark ? '#3b82f6' : '#2563eb',
});

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchBox: {
    flexGrow: 1,
    flexBasis: 240,
  },
  yearSelect: {
    width: 120,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 14,
  },
  addButtonText: {
    color: '#ffffff',
  },
  filterPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipDot: {
    marginRight: 6,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateField: {
    flexGrow: 1,
    flexBasis: 160,
  },
  clearFilters: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
    marginBottom: 8,
  },
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
    paddingRight: 8,
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
  cellTextMuted: {
    fontSize: 12,
    marginTop: 2,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    flexShrink: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cellNumber: {
    width: 90,
  },
  cellName: {
    width: 200,
  },
  cellType: {
    width: 120,
  },
  cellPriority: {
    width: 110,
  },
  cellState: {
    width: 110,
  },
  cellAddress: {
    width: 220,
  },
  cellDate: {
    width: 170,
  },
});
