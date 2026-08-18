import { type Href, router } from 'expo-router';
import { Circle, ExternalLink, Filter, MapPin, Plus, Search, Truck, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { isUnitDispatch } from '@/lib/dispatch-types';
import { isUnitAvailable } from '@/lib/resource-availability';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';

import { AnimatedRefreshIcon } from './animated-refresh-icon';
import { PanelHeader } from './panel-header';
import { ResourcesPanel } from './resources-panel';

interface UnitsPanelProps {
  units: UnitInfoResultData[];
  isLoading: boolean;
  onRefresh: () => void;
  selectedUnitId?: string;
  onSelectUnit?: (unitId: string) => void;
  // Call filter props
  isCallFilterActive?: boolean;
  selectedCallId?: string;
  callDispatches?: DispatchedEventResultData[];
  onSetUnitStatusForCall?: (unitId: string, unitName: string) => void;
  // Personnel props — forwarded to the combined ResourcesPanel in single-list mode
  selectedPersonnelId?: string;
  onSelectPersonnel?: (personnelId: string, person: PersonnelInfoResultData) => void;
  onSetPersonnelStatusForCall?: (personnelId: string, personnelName: string) => void;
}

const getStatusColor = (statusColor: string | undefined, statusId: string): string => {
  // If the API provides a color, use it
  if (statusColor) {
    return statusColor;
  }
  // Fallback to common status colors based on status ID
  const statusColors: Record<string, string> = {
    available: '#22c55e',
    responding: '#f59e0b',
    on_scene: '#3b82f6',
    busy: '#ef4444',
    out_of_service: '#6b7280',
  };
  return statusColors[statusId?.toLowerCase()] || '#6b7280';
};

const UnitItem: React.FC<{
  unit: UnitInfoResultData;
  isSelected: boolean;
  isOnCall?: boolean;
  onSelect?: (unitId: string) => void;
  onSetStatusForUnit?: (unitId: string, unitName: string) => void;
}> = React.memo(({ unit, isSelected, isOnCall, onSelect, onSetStatusForUnit }) => {
  const { t } = useTranslation();
  const statusColor = getStatusColor(unit.CurrentStatusColor, unit.CurrentStatusId);
  const hasDestination = unit.CurrentDestinationName && unit.CurrentDestinationName.trim() !== '';

  return (
    <Pressable onPress={() => onSelect?.(unit.UnitId)}>
      <Box className={`mb-2 rounded-lg border bg-white p-2 dark:bg-gray-800 ${isSelected ? 'border-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center" space="sm">
            <View style={StyleSheet.flatten([styles.statusIndicator, { backgroundColor: statusColor }])}>
              <Icon as={Truck} size="xs" color="#fff" />
            </View>
            <VStack className="flex-1">
              <HStack className="items-center" space="xs">
                <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
                  {unit.Name}
                </Text>
                {isOnCall ? (
                  <Badge size="sm" className="bg-blue-100 dark:bg-blue-900">
                    <Text className="text-xs text-blue-700 dark:text-blue-300">{t('dispatch.on_call')}</Text>
                  </Badge>
                ) : null}
              </HStack>
              <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                {unit.Type || unit.GroupName || t('dispatch.unassigned')}
              </Text>
              {hasDestination ? (
                <HStack className="mt-0.5 items-center" space="xs">
                  <Icon as={MapPin} size="xs" className="text-amber-500" />
                  <Text className="text-xs font-medium text-amber-600 dark:text-amber-400" numberOfLines={1}>
                    {unit.CurrentDestinationName}
                  </Text>
                </HStack>
              ) : null}
            </VStack>
          </HStack>
          <VStack className="items-end" space="xs">
            <HStack className="items-center" space="xs">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/units/${unit.UnitId}` as Href);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.detailsButton}
              >
                <ExternalLink size={12} color="#6b7280" />
              </Pressable>
              <Circle size={8} fill={statusColor} color={statusColor} />
              <Text style={{ color: statusColor }} className="text-xs font-medium">
                {unit.CurrentStatus || unit.Note || t('dispatch.available')}
              </Text>
            </HStack>
            {unit.Latitude && unit.Longitude ? (
              <HStack className="items-center" space="xs">
                <Icon as={MapPin} size="xs" className="text-gray-400" />
                <Text className="text-xs text-gray-400">GPS</Text>
              </HStack>
            ) : null}
            {onSetStatusForUnit ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onSetStatusForUnit(unit.UnitId, unit.Name);
                }}
                style={styles.statusButton}
              >
                <Icon as={Plus} size="xs" className="text-indigo-500" />
              </Pressable>
            ) : null}
          </VStack>
        </HStack>
      </Box>
    </Pressable>
  );
});

UnitItem.displayName = 'UnitItem';

const UnitsPanelComponent: React.FC<UnitsPanelProps> = ({
  units,
  isLoading,
  onRefresh,
  selectedUnitId,
  onSelectUnit,
  isCallFilterActive,
  selectedCallId,
  callDispatches,
  onSetUnitStatusForCall,
  selectedPersonnelId,
  onSelectPersonnel,
  onSetPersonnelStatusForCall,
}) => {
  const { t } = useTranslation();
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('units'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const availableOnly = useDashboardViewStore((s) => s.availableOnly);
  const singleList = useDashboardViewStore((s) => s.singleList);

  // Filter units based on call dispatches when filter is active and search query
  const displayedUnits = useMemo(() => {
    let filtered = units;

    if (isCallFilterActive && callDispatches && callDispatches.length > 0) {
      // Get unit names from dispatches (dispatches contain unit info by name)
      const dispatchedUnitNames = callDispatches.filter(isUnitDispatch).map((d) => d.Name.toLowerCase());

      // Also check units whose CurrentDestinationId matches the call
      filtered = units.filter((u) => dispatchedUnitNames.includes(u.Name.toLowerCase()) || (selectedCallId && u.CurrentDestinationId === selectedCallId));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((u) => {
        const name = (u.Name || '').toLowerCase();
        const type = (u.Type || '').toLowerCase();
        const groupName = (u.GroupName || '').toLowerCase();
        const status = (u.CurrentStatus || '').toLowerCase();
        const note = (u.Note || '').toLowerCase();
        return name.includes(query) || type.includes(query) || groupName.includes(query) || status.includes(query) || note.includes(query);
      });
    }

    // Show only currently-available units when the dashboard toggle is on
    if (availableOnly) {
      filtered = filtered.filter(isUnitAvailable);
    }

    return filtered;
  }, [units, isCallFilterActive, callDispatches, selectedCallId, searchQuery, availableOnly]);

  // Get list of unit names that are dispatched to the call
  const dispatchedUnitNames = useMemo(() => {
    if (!callDispatches) return new Set<string>();
    return new Set(callDispatches.filter(isUnitDispatch).map((d) => d.Name.toLowerCase()));
  }, [callDispatches]);

  // Count available units
  const availableUnits = displayedUnits.filter((u) => !u.CurrentStatusId || u.CurrentStatusId === 'available').length;

  const handleSelectUnit = useCallback(
    (unitId: string) => {
      onSelectUnit?.(unitId);
    },
    [onSelectUnit]
  );

  const renderUnitItem = useCallback(
    ({ item }: { item: UnitInfoResultData }) => (
      <UnitItem
        unit={item}
        isSelected={selectedUnitId === item.UnitId}
        isOnCall={dispatchedUnitNames.has(item.Name.toLowerCase()) || Boolean(selectedCallId && item.CurrentDestinationId === selectedCallId)}
        onSelect={handleSelectUnit}
        onSetStatusForUnit={isCallFilterActive ? onSetUnitStatusForCall : undefined}
      />
    ),
    [selectedUnitId, dispatchedUnitNames, selectedCallId, handleSelectUnit, isCallFilterActive, onSetUnitStatusForCall]
  );

  const keyExtractor = useCallback((item: UnitInfoResultData) => item.UnitId, []);

  // When "single list" is on, units + personnel are shown together in the combined ResourcesPanel
  // (rendered from the units slot); the Personnel panel hides itself.
  if (singleList) {
    return (
      <ResourcesPanel
        isCallFilterActive={isCallFilterActive}
        selectedCallId={selectedCallId}
        callDispatches={callDispatches}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        onSetUnitStatusForCall={onSetUnitStatusForCall}
        selectedPersonnelId={selectedPersonnelId}
        onSelectPersonnel={onSelectPersonnel}
        onSetPersonnelStatusForCall={onSetPersonnelStatusForCall}
      />
    );
  }

  return (
    <Box className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}>
      <PanelHeader
        title={isCallFilterActive ? t('dispatch.units_on_call') : t('dispatch.units')}
        icon={Truck}
        iconColor="#3b82f6"
        count={displayedUnits.length}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCardCollapsed('units', !isCollapsed)}
        rightContent={
          <HStack space="xs">
            <HStack className="items-center rounded bg-green-100 px-1.5 py-0.5 dark:bg-green-900" space="xs">
              <Circle size={6} fill="#22c55e" color="#22c55e" />
              <Text className="text-xs font-medium text-green-700 dark:text-green-300">{availableUnits}</Text>
            </HStack>
            {isCallFilterActive ? (
              <Badge size="sm" className="bg-indigo-100 dark:bg-indigo-900">
                <HStack className="items-center" space="xs">
                  <Icon as={Filter} size="xs" className="text-indigo-600 dark:text-indigo-300" />
                  <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{t('dispatch.filtered')}</Text>
                </HStack>
              </Badge>
            ) : null}
            <Pressable onPress={onRefresh} style={styles.iconButton}>
              <AnimatedRefreshIcon isLoading={isLoading} />
            </Pressable>
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
              placeholder={t('dispatch.search_units_placeholder')}
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
          <FlatList<UnitInfoResultData>
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            data={displayedUnits}
            renderItem={renderUnitItem}
            keyExtractor={keyExtractor}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon as={Truck} size="lg" className="text-gray-300 dark:text-gray-600" />
                <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{isCallFilterActive ? t('dispatch.no_units_on_call') : t('dispatch.no_units')}</Text>
              </View>
            }
          />
        </View>
      ) : null}
    </Box>
  );
};

// Memoized: the panel hangs directly off the dispatch console, so without this any console
// re-render walks its entire subtree.
export const UnitsPanel = React.memo(UnitsPanelComponent);

UnitsPanel.displayName = 'UnitsPanel';

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
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 6,
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
  },
  detailsButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  statusButton: {
    padding: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 4,
  },
});
