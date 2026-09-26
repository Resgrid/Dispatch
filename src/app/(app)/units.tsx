import { type Href, router, useFocusEffect } from 'expo-router';
import { Circle, MapPin, Search, Truck, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useUnitsStore } from '@/stores/units/store';

const UnitCard: React.FC<{
  unit: UnitInfoResultData;
  onPress: () => void;
}> = React.memo(({ unit, onPress }) => {
  const { t } = useTranslation();
  const statusColor = unit.CurrentStatusColor || '#6b7280';
  const hasDestination = unit.CurrentDestinationName && unit.CurrentDestinationName.trim() !== '';

  return (
    <Pressable onPress={onPress} style={styles.cardPressable}>
      <Box className="mb-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <HStack className="items-center" space="md">
          {/* Icon */}
          <View style={[styles.unitIcon, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
            <Icon as={Truck} size="sm" color={statusColor} />
          </View>

          {/* Info */}
          <VStack className="flex-1" space="xs">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
              {unit.Name}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {unit.Type || unit.GroupName || t('units.unknown_status')}
            </Text>
            {unit.Roles && unit.Roles.length > 0 ? (
              <Text className="text-xs text-indigo-500 dark:text-indigo-400" numberOfLines={1}>
                {unit.Roles.map((r) => `${r.RoleName}: ${r.Name}`).join(', ')}
              </Text>
            ) : null}
            {hasDestination ? (
              <HStack className="mt-0.5 items-center" space="xs">
                <Icon as={MapPin} size="xs" className="text-amber-500" />
                <Text className="text-xs font-medium text-amber-600 dark:text-amber-400" numberOfLines={1}>
                  {unit.CurrentDestinationName}
                </Text>
              </HStack>
            ) : null}
          </VStack>

          {/* Status */}
          <VStack className="items-end" space="xs">
            <HStack className="items-center rounded-full px-2 py-0.5" space="xs" style={{ backgroundColor: `${statusColor}18` }}>
              <Circle size={8} fill={statusColor} color={statusColor} />
              <Text style={{ color: statusColor }} className="text-xs font-semibold">
                {unit.CurrentStatus || t('units.unknown_status')}
              </Text>
            </HStack>
            {unit.Latitude && unit.Longitude ? (
              <HStack className="items-center" space="xs">
                <Icon as={MapPin} size="xs" className="text-gray-400" />
                <Text className="text-xs text-gray-400">GPS</Text>
              </HStack>
            ) : null}
          </VStack>
        </HStack>
      </Box>
    </Pressable>
  );
});

UnitCard.displayName = 'UnitCard';

export default function Units() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { units, isLoading, error, fetchUnits } = useUnitsStore();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchUnits();
    }, [fetchUnits])
  );

  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return units;
    const query = searchQuery.toLowerCase().trim();
    return units.filter((u) => {
      const name = (u.Name || '').toLowerCase();
      const type = (u.Type || '').toLowerCase();
      const groupName = (u.GroupName || '').toLowerCase();
      const status = (u.CurrentStatus || '').toLowerCase();
      const note = (u.Note || '').toLowerCase();
      const roles = (u.Roles || [])
        .map((r) => `${r.RoleName} ${r.Name}`)
        .join(' ')
        .toLowerCase();
      return name.includes(query) || type.includes(query) || groupName.includes(query) || status.includes(query) || note.includes(query) || roles.includes(query);
    });
  }, [units, searchQuery]);

  const handleUnitPress = useCallback(
    (unit: UnitInfoResultData) => {
      trackEvent('unit_detail_opened', { unitId: unit.UnitId });
      router.push(`/units/${unit.UnitId}` as Href);
    },
    [trackEvent]
  );

  const renderItem = useCallback(({ item }: { item: UnitInfoResultData }) => <UnitCard unit={item} onPress={() => handleUnitPress(item)} />, [handleUnitPress]);

  const keyExtractor = useCallback((item: UnitInfoResultData) => item.UnitId, []);

  const renderContent = () => {
    if (isLoading && units.length === 0) {
      return <Loading text={t('units.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    const hasSearch = searchQuery.trim().length > 0;
    const emptyHeading = hasSearch ? t('units.no_results') : t('units.empty');
    const emptyDescription = hasSearch ? t('units.no_results_description') : t('units.empty_description');

    return (
      <FlatList<UnitInfoResultData>
        testID="units-list"
        data={filteredUnits}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchUnits} />}
        ListEmptyComponent={<ZeroState heading={emptyHeading} description={emptyDescription} icon={Truck} />}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search input */}
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('units.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Results count */}
        {units.length > 0 && !isLoading ? (
          <HStack className="mb-2 items-center justify-between px-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400">{searchQuery.trim() ? `${filteredUnits.length} of ${units.length}` : `${units.length} units`}</Text>
          </HStack>
        ) : null}

        {/* Main content */}
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
    </View>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    // Ensures the pressable area covers the full card
  },
  unitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
});
