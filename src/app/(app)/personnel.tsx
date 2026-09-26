import { type Href, router, useFocusEffect } from 'expo-router';
import { Circle, Search, User, Users, X } from 'lucide-react-native';
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
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { usePersonnelStore } from '@/stores/personnel/store';

const PersonnelCard: React.FC<{
  person: PersonnelInfoResultData;
  onPress: () => void;
}> = React.memo(({ person, onPress }) => {
  const { t } = useTranslation();
  const statusColor = person.StatusColor || '#6b7280';
  const staffingColor = person.StaffingColor || '#6b7280';

  return (
    <Pressable onPress={onPress} style={styles.cardPressable}>
      <Box className="mb-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <HStack className="items-center" space="md">
          {/* Avatar */}
          <View style={[styles.avatar, { borderColor: statusColor }]}>
            <Icon as={User} size="sm" color={statusColor} />
          </View>

          {/* Info */}
          <VStack className="flex-1" space="xs">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
              {person.FirstName} {person.LastName}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {person.GroupName || t('personnel.no_group')}
            </Text>
            {person.Roles && person.Roles.length > 0 ? (
              <Text className="text-xs text-indigo-500 dark:text-indigo-400" numberOfLines={1}>
                {person.Roles.join(', ')}
              </Text>
            ) : null}
          </VStack>

          {/* Status badges */}
          <VStack className="items-end" space="xs">
            <HStack className="items-center rounded-full px-2 py-0.5" space="xs" style={{ backgroundColor: `${statusColor}18` }}>
              <Circle size={8} fill={statusColor} color={statusColor} />
              <Text style={{ color: statusColor }} className="text-xs font-semibold">
                {person.Status || t('personnel.unknown_status')}
              </Text>
            </HStack>
            <HStack className="items-center rounded-full px-2 py-0.5" space="xs" style={{ backgroundColor: `${staffingColor}18` }}>
              <Circle size={6} fill={staffingColor} color={staffingColor} />
              <Text className="text-xs" style={{ color: staffingColor }}>
                {person.Staffing || t('personnel.unknown_status')}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Box>
    </Pressable>
  );
});

PersonnelCard.displayName = 'PersonnelCard';

export default function Personnel() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { personnel, isLoading, error, fetchPersonnel } = usePersonnelStore();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchPersonnel();
    }, [fetchPersonnel])
  );

  const filteredPersonnel = useMemo(() => {
    if (!searchQuery.trim()) return personnel;
    const query = searchQuery.toLowerCase().trim();
    return personnel.filter((p) => {
      const fullName = `${p.FirstName} ${p.LastName}`.toLowerCase();
      const group = (p.GroupName || '').toLowerCase();
      const status = (p.Status || '').toLowerCase();
      const staffing = (p.Staffing || '').toLowerCase();
      const roles = (p.Roles || []).join(' ').toLowerCase();
      return fullName.includes(query) || group.includes(query) || status.includes(query) || staffing.includes(query) || roles.includes(query);
    });
  }, [personnel, searchQuery]);

  const handlePersonPress = useCallback(
    (person: PersonnelInfoResultData) => {
      trackEvent('personnel_detail_opened', { userId: person.UserId });
      router.push(`/personnel/${person.UserId}` as Href);
    },
    [trackEvent]
  );

  const renderItem = useCallback(({ item }: { item: PersonnelInfoResultData }) => <PersonnelCard person={item} onPress={() => handlePersonPress(item)} />, [handlePersonPress]);

  const keyExtractor = useCallback((item: PersonnelInfoResultData) => item.UserId, []);

  const renderContent = () => {
    if (isLoading && personnel.length === 0) {
      return <Loading text={t('personnel.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    const hasSearch = searchQuery.trim().length > 0;
    const emptyHeading = hasSearch ? t('personnel.no_results') : t('personnel.empty');
    const emptyDescription = hasSearch ? t('personnel.no_results_description') : t('personnel.empty_description');

    return (
      <FlatList<PersonnelInfoResultData>
        testID="personnel-list"
        data={filteredPersonnel}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchPersonnel} />}
        ListEmptyComponent={<ZeroState heading={emptyHeading} description={emptyDescription} icon={Users} />}
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
          <InputField placeholder={t('personnel.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Results count */}
        {personnel.length > 0 && !isLoading ? (
          <HStack className="mb-2 items-center justify-between px-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400">{searchQuery.trim() ? `${filteredPersonnel.length} of ${personnel.length}` : `${personnel.length} personnel`}</Text>
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  listContent: {
    paddingBottom: 20,
  },
});
