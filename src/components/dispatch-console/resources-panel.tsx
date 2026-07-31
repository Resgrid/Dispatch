import { type Href, router } from 'expo-router';
import { Circle, ExternalLink, LayoutList, Plus, Search, Truck, User, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { isPersonnelDispatch, isUnitDispatch } from '@/lib/dispatch-types';
import { isPersonnelAvailable, isUnitAvailable } from '@/lib/resource-availability';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';
import { usePersonnelStore } from '@/stores/personnel/store';
import { useUnitsStore } from '@/stores/units/store';

import { AnimatedRefreshIcon } from './animated-refresh-icon';
import { PanelHeader } from './panel-header';

interface ResourcesPanelProps {
  selectedUnitId?: string;
  selectedPersonnelId?: string;
  onSelectUnit?: (unitId: string) => void;
  onSelectPersonnel?: (personnelId: string, person: PersonnelInfoResultData) => void;
  // Call filter props
  isCallFilterActive?: boolean;
  selectedCallId?: string;
  callDispatches?: DispatchedEventResultData[];
  onSetUnitStatusForCall?: (unitId: string, unitName: string) => void;
  onSetPersonnelStatusForCall?: (personnelId: string, personnelName: string) => void;
}

type ResourceRow = {
  id: string;
  kind: 'unit' | 'personnel';
  entityId: string;
  name: string;
  subtitle: string;
  status: string;
  statusColor: string;
  available: boolean;
  isOnCall: boolean;
  href: string;
  unit?: UnitInfoResultData;
  person?: PersonnelInfoResultData;
};

type ResourcePressEvent = Parameters<NonNullable<React.ComponentProps<typeof Pressable>['onPress']>>[0];

/**
 * A single combined list of units + personnel for the dispatch dashboard, used when the "single list"
 * toggle is on. Reads units and personnel from their stores and mirrors the call-aware behaviour of
 * UnitsPanel/PersonnelPanel (call filtering, on-call highlighting, selection, and status actions) so it
 * stays a drop-in replacement. The call-context props are threaded through from UnitsPanel.
 */
export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({
  selectedUnitId,
  selectedPersonnelId,
  onSelectUnit,
  onSelectPersonnel,
  isCallFilterActive,
  selectedCallId,
  callDispatches,
  onSetUnitStatusForCall,
  onSetPersonnelStatusForCall,
}) => {
  const { t } = useTranslation();
  const units = useUnitsStore((s) => s.units);
  const unitsLoading = useUnitsStore((s) => s.isLoading);
  const fetchUnits = useUnitsStore((s) => s.fetchUnits);
  const personnel = usePersonnelStore((s) => s.personnel);
  const personnelLoading = usePersonnelStore((s) => s.isLoading);
  const fetchPersonnel = usePersonnelStore((s) => s.fetchPersonnel);
  const availableOnly = useDashboardViewStore((s) => s.availableOnly);
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('resources'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [searchQuery, setSearchQuery] = useState('');

  // Unit names dispatched to the call — used for on-call highlighting (mirrors UnitsPanel).
  const dispatchedUnitNames = useMemo(() => {
    if (!callDispatches) return new Set<string>();
    return new Set(callDispatches.filter(isUnitDispatch).map((d) => d.Name.toLowerCase()));
  }, [callDispatches]);

  // Personnel ids/names dispatched to the call, with the same strict-then-fallback matching PersonnelPanel uses.
  const dispatchedPersonnelIds = useMemo(() => {
    if (!callDispatches) return new Set<string>();
    const byType = callDispatches.filter(isPersonnelDispatch);
    const ids = new Set(byType.map((d) => d.Id).filter(Boolean));
    if (ids.size === 0) {
      return new Set(callDispatches.map((d) => d.Id).filter(Boolean));
    }
    return ids;
  }, [callDispatches]);

  const dispatchedPersonnelNames = useMemo(() => {
    if (!callDispatches) return new Set<string>();
    const byType = new Set(callDispatches.filter(isPersonnelDispatch).map((d) => d.Name.toLowerCase()));
    if (byType.size === 0) {
      return new Set(callDispatches.map((d) => d.Name.toLowerCase()));
    }
    return byType;
  }, [callDispatches]);

  const rows = useMemo<ResourceRow[]>(() => {
    // Call filter: narrow to units dispatched to (or destined for) the call, mirroring UnitsPanel.
    let unitSource = units;
    if (isCallFilterActive && callDispatches && callDispatches.length > 0) {
      const names = callDispatches.filter(isUnitDispatch).map((d) => d.Name.toLowerCase());
      unitSource = units.filter((u) => names.includes(u.Name.toLowerCase()) || Boolean(selectedCallId && u.CurrentDestinationId === selectedCallId));
    }

    // Call filter: narrow to personnel dispatched to (or destined for) the call, mirroring PersonnelPanel.
    let personnelSource = personnel;
    if (isCallFilterActive && callDispatches && callDispatches.length > 0) {
      const personnelDispatches = callDispatches.filter(isPersonnelDispatch);
      const ids = new Set(personnelDispatches.map((d) => d.Id).filter(Boolean));
      const names = new Set(personnelDispatches.map((d) => d.Name.toLowerCase()));
      personnelSource = personnel.filter((p) => {
        if (ids.size > 0 && ids.has(p.UserId)) return true;
        if (selectedCallId && p.StatusDestinationId === selectedCallId) return true;
        return names.has(`${p.FirstName} ${p.LastName}`.toLowerCase());
      });
      // If strict type matching found nothing, fall back to matching all dispatch ids/names.
      if (personnelSource.length === 0) {
        const allIds = new Set(callDispatches.map((d) => d.Id).filter(Boolean));
        const allNames = new Set(callDispatches.map((d) => d.Name.toLowerCase()));
        personnelSource = personnel.filter((p) => {
          if (allIds.has(p.UserId)) return true;
          if (selectedCallId && p.StatusDestinationId === selectedCallId) return true;
          return allNames.has(`${p.FirstName} ${p.LastName}`.toLowerCase());
        });
      }
    }

    const unitRows: ResourceRow[] = unitSource.map((u) => ({
      id: `unit-${u.UnitId}`,
      kind: 'unit',
      entityId: u.UnitId,
      name: u.Name,
      subtitle: u.Type || u.GroupName || t('dispatch.unassigned'),
      status: u.CurrentStatus || t('dispatch.available'),
      statusColor: u.CurrentStatusColor || '#22c55e',
      available: isUnitAvailable(u),
      isOnCall: dispatchedUnitNames.has(u.Name.toLowerCase()) || Boolean(selectedCallId && u.CurrentDestinationId === selectedCallId),
      href: `/units/${u.UnitId}`,
      unit: u,
    }));
    const personnelRows: ResourceRow[] = personnelSource.map((p) => {
      const fullName = `${p.FirstName} ${p.LastName}`;
      return {
        id: `person-${p.UserId}`,
        kind: 'personnel',
        entityId: p.UserId,
        name: fullName,
        subtitle: p.GroupName || t('dispatch.unassigned'),
        status: p.Status || t('dispatch.unknown'),
        statusColor: p.StatusColor || '#6b7280',
        available: isPersonnelAvailable(p),
        isOnCall: dispatchedPersonnelIds.has(p.UserId) || dispatchedPersonnelNames.has(fullName.toLowerCase()) || Boolean(selectedCallId && p.StatusDestinationId === selectedCallId),
        href: `/personnel/${p.UserId}`,
        person: p,
      };
    });

    let all = [...unitRows, ...personnelRows];
    if (availableOnly) {
      all = all.filter((r) => r.available);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      all = all.filter((r) => r.name.toLowerCase().includes(query) || r.subtitle.toLowerCase().includes(query) || r.status.toLowerCase().includes(query));
    }
    return all;
  }, [units, personnel, availableOnly, searchQuery, isCallFilterActive, callDispatches, selectedCallId, dispatchedUnitNames, dispatchedPersonnelIds, dispatchedPersonnelNames, t]);

  const availableCount = useMemo(() => rows.filter((r) => r.available).length, [rows]);

  const handleRefresh = () => {
    fetchUnits();
    fetchPersonnel();
  };

  const handleSelect = React.useCallback(
    (r: ResourceRow) => {
      if (r.kind === 'unit') {
        if (onSelectUnit) {
          onSelectUnit(r.entityId);
          return;
        }
      } else if (onSelectPersonnel && r.person) {
        onSelectPersonnel(r.entityId, r.person);
        return;
      }
      // Fall back to opening the detail screen when no selection handler is wired.
      router.push(r.href as Href);
    },
    [onSelectPersonnel, onSelectUnit]
  );

  const getSetStatusHandler = React.useCallback(
    (r: ResourceRow): (() => void) | undefined => {
      if (!isCallFilterActive) return undefined;
      if (r.kind === 'unit') {
        return onSetUnitStatusForCall ? () => onSetUnitStatusForCall(r.entityId, r.name) : undefined;
      }
      return onSetPersonnelStatusForCall ? () => onSetPersonnelStatusForCall(r.entityId, r.name) : undefined;
    },
    [isCallFilterActive, onSetPersonnelStatusForCall, onSetUnitStatusForCall]
  );

  const rowPressHandlers = useMemo(() => new Map(rows.map((r) => [r.id, () => handleSelect(r)])), [handleSelect, rows]);

  const detailPressHandlers = useMemo(
    () =>
      new Map(
        rows.map((r) => [
          r.id,
          (event: ResourcePressEvent) => {
            event.stopPropagation();
            router.push(r.href as Href);
          },
        ])
      ),
    [rows]
  );

  const statusPressHandlers = useMemo(() => {
    const handlers = new Map<string, (event: ResourcePressEvent) => void>();
    rows.forEach((r) => {
      const onSetStatus = getSetStatusHandler(r);
      if (onSetStatus) {
        handlers.set(r.id, (event) => {
          event.stopPropagation();
          onSetStatus();
        });
      }
    });
    return handlers;
  }, [getSetStatusHandler, rows]);

  return (
    <Box className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}>
      <PanelHeader
        title={t('dispatch.resources')}
        icon={LayoutList}
        iconColor="#6366f1"
        count={rows.length}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCardCollapsed('resources', !isCollapsed)}
        rightContent={
          <HStack space="xs">
            <HStack className="items-center rounded bg-green-100 px-1.5 py-0.5 dark:bg-green-900" space="xs">
              <Circle size={6} fill="#22c55e" color="#22c55e" />
              <Text className="text-xs font-medium text-green-700 dark:text-green-300">{availableCount}</Text>
            </HStack>
            {isCallFilterActive ? (
              <Badge size="sm" className="bg-indigo-100 dark:bg-indigo-900">
                <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{t('dispatch.filtered')}</Text>
              </Badge>
            ) : null}
            <Pressable onPress={handleRefresh} style={styles.iconButton}>
              <AnimatedRefreshIcon isLoading={unitsLoading || personnelLoading} />
            </Pressable>
          </HStack>
        }
      />

      {!isCollapsed ? (
        <View style={styles.contentWrapper}>
          <HStack className="items-center border-b border-gray-200 px-2 py-1.5 dark:border-gray-700" space="sm">
            <Icon as={Search} size="xs" className="text-gray-400" />
            <TextInput
              style={styles.searchInput}
              className="flex-1 text-sm text-gray-800 dark:text-gray-100"
              placeholder={t('dispatch.search_resources_placeholder')}
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
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {rows.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon as={LayoutList} size="lg" className="text-gray-300 dark:text-gray-600" />
                <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('dispatch.no_resources')}</Text>
              </View>
            ) : (
              rows.map((r) => {
                const onSetStatus = statusPressHandlers.get(r.id);
                const isSelected = (r.kind === 'unit' && selectedUnitId === r.entityId) || (r.kind === 'personnel' && selectedPersonnelId === r.entityId);
                return (
                  <Pressable key={r.id} onPress={rowPressHandlers.get(r.id)}>
                    <Box className={`mb-2 rounded-lg border bg-white p-2 dark:bg-gray-800 ${isSelected ? 'border-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
                      <HStack className="items-center justify-between">
                        <HStack className="flex-1 items-center" space="sm">
                          <View style={StyleSheet.flatten([styles.icon, { backgroundColor: r.statusColor }])}>
                            <Icon as={r.kind === 'unit' ? Truck : User} size="xs" color="#fff" />
                          </View>
                          <VStack className="flex-1">
                            <HStack className="items-center" space="xs">
                              <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
                                {r.name}
                              </Text>
                              {r.isOnCall ? (
                                <Badge size="sm" className={r.kind === 'unit' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-purple-100 dark:bg-purple-900'}>
                                  <Text className={`text-xs ${r.kind === 'unit' ? 'text-blue-700 dark:text-blue-300' : 'text-purple-700 dark:text-purple-300'}`}>{t('dispatch.on_call')}</Text>
                                </Badge>
                              ) : null}
                            </HStack>
                            <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                              {r.subtitle}
                            </Text>
                          </VStack>
                        </HStack>
                        <HStack className="items-center" space="xs">
                          <Pressable onPress={detailPressHandlers.get(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.detailsButton}>
                            <ExternalLink size={12} color="#6b7280" />
                          </Pressable>
                          <Circle size={8} fill={r.statusColor} color={r.statusColor} />
                          <Text style={{ color: r.statusColor }} className="text-xs font-medium" numberOfLines={1}>
                            {r.status}
                          </Text>
                          {onSetStatus ? (
                            <Pressable onPress={onSetStatus} style={styles.statusButton}>
                              <Icon as={Plus} size="xs" className="text-indigo-500" />
                            </Pressable>
                          ) : null}
                        </HStack>
                      </HStack>
                    </Box>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
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
    padding: 8,
  },
  icon: {
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
