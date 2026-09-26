import { type Href, router, useFocusEffect } from 'expo-router';
import { ChevronDownIcon, MapPinned, Search, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { PoiCard } from '@/components/pois/poi-card';
import { FocusAwareStatusBar } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { getPoiPrimaryDisplayText, getPoiSearchValue } from '@/lib/poi-display';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { usePoisStore } from '@/stores/pois/store';

type PoiSortOption = 'name-asc' | 'name-desc' | 'type-asc' | 'address-asc';

export default function Pois() {
  const { t } = useTranslation();
  const { pois, poiTypes, isLoading, error, fetchPoiTypes, fetchPois } = usePoisStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoiTypeId, setSelectedPoiTypeId] = useState('all');
  const [sortOption, setSortOption] = useState<PoiSortOption>('name-asc');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPoiTypes();
      fetchPois();
    }, [fetchPoiTypes, fetchPois])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([fetchPoiTypes(true), fetchPois(true)]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPoiTypes, fetchPois]);

  const filteredPois = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...pois]
      .filter((poi) => (selectedPoiTypeId === 'all' ? true : poi.PoiTypeId.toString() === selectedPoiTypeId))
      .filter((poi) => (normalizedQuery ? getPoiSearchValue(poi).includes(normalizedQuery) : true))
      .sort((left, right) => sortPois(left, right, sortOption));
  }, [pois, searchQuery, selectedPoiTypeId, sortOption]);

  const typeValue = poiTypes.find((poiType) => poiType.PoiTypeId.toString() === selectedPoiTypeId)?.Name ?? t('pois.all_types');
  const sortValue = t(`pois.sort_options.${sortOption}`);

  if (isLoading && pois.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar />
        <Loading text={t('pois.loading')} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField testID="poi-search-input" placeholder={t('pois.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        <Box className="mb-3">
          <Select onValueChange={setSelectedPoiTypeId} selectedValue={selectedPoiTypeId}>
            <SelectTrigger>
              <SelectInput placeholder={t('pois.filter_by_type')} value={typeValue} className="w-5/6" />
              <SelectIcon as={ChevronDownIcon} className="mr-3" />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectItem label={t('pois.all_types')} value="all" />
                {poiTypes.map((poiType) => (
                  <SelectItem key={poiType.PoiTypeId} label={poiType.Name} value={poiType.PoiTypeId.toString()} />
                ))}
              </SelectContent>
            </SelectPortal>
          </Select>
        </Box>

        <Box className="mb-4">
          <Select onValueChange={(value) => setSortOption(value as PoiSortOption)} selectedValue={sortOption}>
            <SelectTrigger>
              <SelectInput placeholder={t('pois.sort')} value={sortValue} className="w-5/6" />
              <SelectIcon as={ChevronDownIcon} className="mr-3" />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectItem label={t('pois.sort_options.name-asc')} value="name-asc" />
                <SelectItem label={t('pois.sort_options.name-desc')} value="name-desc" />
                <SelectItem label={t('pois.sort_options.type-asc')} value="type-asc" />
                <SelectItem label={t('pois.sort_options.address-asc')} value="address-asc" />
              </SelectContent>
            </SelectPortal>
          </Select>
        </Box>

        {error && pois.length === 0 ? (
          <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />
        ) : (
          <FlatList<PoiResultData>
            testID="pois-list"
            data={filteredPois}
            keyExtractor={(item) => item.PoiId.toString()}
            renderItem={({ item }) => <PoiCard poi={item} onPress={(poi) => router.push(`/poi/${poi.PoiId}` as Href)} />}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <ZeroState
                icon={MapPinned}
                heading={searchQuery || selectedPoiTypeId !== 'all' ? t('pois.empty_filtered') : t('pois.empty')}
                description={searchQuery || selectedPoiTypeId !== 'all' ? t('pois.empty_filtered_description') : t('pois.empty_description')}
              />
            }
          />
        )}
      </Box>
    </View>
  );
}

const sortPois = (left: PoiResultData, right: PoiResultData, sortOption: PoiSortOption) => {
  switch (sortOption) {
    case 'name-desc':
      return getSortValue(right, 'name').localeCompare(getSortValue(left, 'name'));
    case 'type-asc':
      return getSortValue(left, 'type').localeCompare(getSortValue(right, 'type')) || getSortValue(left, 'name').localeCompare(getSortValue(right, 'name'));
    case 'address-asc':
      return getSortValue(left, 'address').localeCompare(getSortValue(right, 'address')) || getSortValue(left, 'name').localeCompare(getSortValue(right, 'name'));
    case 'name-asc':
    default:
      return getSortValue(left, 'name').localeCompare(getSortValue(right, 'name'));
  }
};

const getSortValue = (poi: PoiResultData, field: 'name' | 'type' | 'address') => {
  switch (field) {
    case 'type':
      return (poi.PoiTypeName || '').toLowerCase();
    case 'address':
      return (poi.Address || getPoiPrimaryDisplayText(poi)).toLowerCase();
    case 'name':
    default:
      return getPoiPrimaryDisplayText(poi).toLowerCase();
  }
};
