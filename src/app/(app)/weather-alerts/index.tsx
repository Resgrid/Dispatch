import { type Href, router, useFocusEffect } from 'expo-router';
import { SettingsIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { WeatherAlertCard } from '@/components/weatherAlerts/weather-alert-card';
import { WeatherAlertSeverity } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';
import { useWeatherAlertsStore } from '@/stores/weatherAlerts/store';

type FilterType = 'all' | 'extreme' | 'severe' | 'moderate' | 'minor';
type SortType = 'severity' | 'expires' | 'newest';

export default function WeatherAlertsListScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { alerts, isLoading, fetchActiveAlerts } = useWeatherAlertsStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('severity');

  useFocusEffect(
    useCallback(() => {
      fetchActiveAlerts();
    }, [fetchActiveAlerts])
  );

  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];

    switch (filter) {
      case 'extreme':
        filtered = filtered.filter((a) => a.Severity === WeatherAlertSeverity.Extreme);
        break;
      case 'severe':
        filtered = filtered.filter((a) => a.Severity === WeatherAlertSeverity.Severe);
        break;
      case 'moderate':
        filtered = filtered.filter((a) => a.Severity === WeatherAlertSeverity.Moderate);
        break;
      case 'minor':
        filtered = filtered.filter((a) => a.Severity === WeatherAlertSeverity.Minor);
        break;
    }

    switch (sort) {
      case 'severity':
        filtered.sort((a, b) => a.Severity - b.Severity || new Date(b.EffectiveUtc).getTime() - new Date(a.EffectiveUtc).getTime());
        break;
      case 'expires':
        filtered.sort((a, b) => {
          const aExp = a.ExpiresUtc ? new Date(a.ExpiresUtc).getTime() : Infinity;
          const bExp = b.ExpiresUtc ? new Date(b.ExpiresUtc).getTime() : Infinity;
          return aExp - bExp;
        });
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.EffectiveUtc).getTime() - new Date(a.EffectiveUtc).getTime());
        break;
    }

    return filtered;
  }, [alerts, filter, sort]);

  const handleAlertPress = (alertId: string) => {
    router.push(`/weather-alerts/${alertId}` as Href);
  };

  const renderFilterButton = (key: FilterType, label: string) => {
    const isActive = filter === key;
    return (
      <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterPill, isActive ? styles.filterPillActive : isDark ? styles.filterPillDark : styles.filterPillLight]}>
        <RNText style={[styles.filterPillText, isActive ? styles.filterPillTextActive : isDark ? styles.filterPillTextDark : styles.filterPillTextLight]} numberOfLines={1}>
          {label}
        </RNText>
      </Pressable>
    );
  };

  const renderSortButton = (key: SortType, label: string) => {
    const isActive = sort === key;
    return (
      <Pressable key={key} onPress={() => setSort(key)} style={[styles.sortPill, isActive && styles.sortPillActive]}>
        <RNText style={[styles.sortPillText, isActive ? (isDark ? styles.sortPillTextActiveDark : styles.sortPillTextActive) : isDark ? styles.sortPillTextDark : styles.sortPillTextLight]}>{label}</RNText>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <VStack className="flex-1 items-center justify-center py-12" space="sm">
        <Text className="text-base text-gray-500 dark:text-gray-400">{t('weatherAlerts.noActiveAlerts')}</Text>
      </VStack>
    );
  };

  const renderItem = useCallback(({ item }: { item: WeatherAlertResultData }) => <WeatherAlertCard alert={item} onPress={handleAlertPress} />, []);

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <RNText style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>{t('weatherAlerts.title')}</RNText>
        <Pressable onPress={() => router.push('/weather-alerts/settings' as Href)} style={styles.settingsButton} testID="weather-alert-settings-button">
          <SettingsIcon size={22} color={isDark ? '#9ca3af' : '#4b5563'} />
        </Pressable>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {renderFilterButton('all', t('weatherAlerts.filter.all'))}
        {renderFilterButton('extreme', t('weatherAlerts.severity.extreme'))}
        {renderFilterButton('severe', t('weatherAlerts.severity.severe'))}
        {renderFilterButton('moderate', t('weatherAlerts.severity.moderate'))}
        {renderFilterButton('minor', t('weatherAlerts.severity.minor'))}
      </ScrollView>

      {/* Sort row */}
      <View style={styles.sortRow}>
        {renderSortButton('severity', t('weatherAlerts.sort.severity'))}
        {renderSortButton('expires', t('weatherAlerts.sort.expires'))}
        {renderSortButton('newest', t('weatherAlerts.sort.newest'))}
      </View>

      {/* List */}
      {isLoading && alerts.length === 0 ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.WeatherAlertId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchActiveAlerts} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerLight: { backgroundColor: '#f3f4f6' },
  containerDark: { backgroundColor: '#030712' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  settingsButton: {
    padding: 8,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleLight: { color: '#111827' },
  titleDark: { color: '#f3f4f6' },

  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterPillLight: {
    backgroundColor: '#e5e7eb',
  },
  filterPillDark: {
    backgroundColor: '#374151',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  filterPillTextLight: {
    color: '#4b5563',
  },
  filterPillTextDark: {
    color: '#9ca3af',
  },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 12,
  },
  sortPill: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sortPillActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  sortPillText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sortPillTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  sortPillTextActiveDark: {
    color: '#60a5fa',
    fontWeight: '600',
  },
  sortPillTextLight: {
    color: '#6b7280',
  },
  sortPillTextDark: {
    color: '#9ca3af',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loader: {
    marginTop: 40,
  },
});
