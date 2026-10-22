import { Building2, Check, MapPinned, Phone, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TypeIcon } from '@/components/common/type-icon';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DestinationCapabilities, type DestinationSelectionType, type DestinationTab } from '@/lib/destination-helpers';
import { filterPoisByCapabilities, getPoiCapabilityOptions } from '@/lib/poi-capabilities';
import { getPoiSelectionLabel } from '@/lib/poi-display';
import { invertColor } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { TermKeys, useTerm } from '@/stores/terminology/store';

// Reusable status option for the action sheet
const StatusSheetOption: React.FC<{
  status: StatusesResultData;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ status, isSelected, onSelect }) => {
  const bgColor = status.BColor || '#6b7280';
  const textColor = invertColor(bgColor, true);

  return (
    <Pressable onPress={onSelect}>
      <HStack
        className={`mb-2 items-center justify-between rounded-lg border-2 px-3 py-2.5 ${
          isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }`}
      >
        <HStack className="items-center" space="sm">
          <View style={StyleSheet.flatten([styles.statusIndicator, { backgroundColor: bgColor }])}>
            <Text style={{ color: textColor }} className="text-sm font-bold">
              {status.Text.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <VStack className="flex-1">
            <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{status.Text}</Text>
            {status.Detail > 0 ? (
              <Text className="text-xs text-gray-500 dark:text-gray-400">{status.Detail === 1 ? 'Station destination' : status.Detail === 2 ? 'Call destination' : 'Call or Station destination'}</Text>
            ) : null}
          </VStack>
        </HStack>
        {isSelected ? (
          <View style={StyleSheet.flatten([styles.checkIcon, { backgroundColor: '#3b82f6' }])}>
            <Icon as={Check} size="sm" color="#fff" />
          </View>
        ) : null}
      </HStack>
    </Pressable>
  );
};

// Destination option for the action sheet
const DestinationSheetOption: React.FC<{
  type: 'call' | 'station' | 'poi' | 'none';
  item?: CallResultData | GroupResultData | PoiResultData;
  isSelected: boolean;
  onSelect: () => void;
  label?: string;
  hint?: string;
  detail?: string;
}> = ({ type, item, isSelected, onSelect, label, hint, detail }) => {
  const isCall = type === 'call';
  const isPoi = type === 'poi';
  const isNone = type === 'none';
  const call = isCall && item ? (item as CallResultData) : null;
  const poi = isPoi && item ? (item as PoiResultData) : null;
  const station = !isCall && !isPoi && !isNone && item ? (item as GroupResultData) : null;

  return (
    <Pressable onPress={onSelect}>
      <HStack
        className={`mb-2 items-center justify-between rounded-lg border px-3 py-2.5 ${
          isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }`}
      >
        <HStack className="flex-1 items-center" space="sm">
          {isNone ? (
            <Icon as={X} size="sm" className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
          ) : (
            <TypeIcon
              iconUrl={call?.TypeIconUrl ?? poi?.IconUrl}
              mapIcon={call?.TypeMapIcon}
              size={18}
              fallback={<Icon as={isCall ? Phone : isPoi ? MapPinned : Building2} size="sm" className={isSelected ? 'text-blue-500' : 'text-gray-500'} />}
            />
          )}
          <VStack className="flex-1">
            <Text className="text-sm font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>
              {isNone ? label : isCall ? `#${call?.Number} - ${call?.Name}` : isPoi ? getPoiSelectionLabel(poi!) : station?.Name}
            </Text>
            {hint ? <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">{hint}</Text> : null}
            {detail ? <Text className="text-xs text-gray-500 dark:text-gray-400">{detail}</Text> : null}
          </VStack>
        </HStack>
        {isSelected ? <Icon as={Check} size="sm" className="text-blue-500" /> : null}
      </HStack>
    </Pressable>
  );
};

interface UnitStatusSheetProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: StatusesResultData[];
  selectedStatusId?: number | null;
  onSelect: (status: StatusesResultData) => void;
}

/** The status picker of the unit actions panels. */
export const UnitStatusSheet: React.FC<UnitStatusSheetProps> = ({ isOpen, onClose, statuses, selectedStatusId, onSelect }) => {
  const { t } = useTranslation();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[50]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="rounded-t-2xl bg-white px-4 pb-6 dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full" space="md">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('dispatch.unit_actions_panel.select_status')}</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {statuses.length === 0 ? (
              <Text className="py-4 text-center text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.no_statuses_available')}</Text>
            ) : (
              statuses.map((status) => <StatusSheetOption key={status.Id} status={status} isSelected={selectedStatusId === status.Id} onSelect={() => onSelect(status)} />)
            )}
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

interface UnitDestinationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  capabilities: DestinationCapabilities;
  activeTab: DestinationTab;
  onTabChange: (tab: DestinationTab) => void;
  calls: CallResultData[];
  stations: GroupResultData[];
  pois: PoiResultData[];
  /** The destination that will be sent with the status (see getEffectiveDestinationType). */
  effectiveDestinationType: DestinationSelectionType;
  selectedCall: CallResultData | null;
  selectedStation: GroupResultData | null;
  selectedPoi: PoiResultData | null;
  onSelect: (type: DestinationSelectionType, item?: CallResultData | GroupResultData | PoiResultData) => void;
  /** The destination POI the unit's call was logged with (e.g. its hospital): listed first and marked. */
  callDestinationPoiId?: number | null;
}

/** The destination picker (no destination, or a call, station or POI) of the unit actions panels. */
export const UnitDestinationSheet: React.FC<UnitDestinationSheetProps> = ({
  isOpen,
  onClose,
  capabilities,
  activeTab,
  onTabChange,
  calls,
  stations,
  pois,
  effectiveDestinationType,
  selectedCall,
  selectedStation,
  selectedPoi,
  onSelect,
  callDestinationPoiId,
}) => {
  const { t } = useTranslation();
  const callsLabel = useTerm(TermKeys.Calls, t('dispatch.calls'));

  // The call's destination POI (e.g. its hospital) is listed first and marked
  const orderedPois = useMemo(() => {
    const callDestination = pois.find((poi) => poi.PoiId === callDestinationPoiId);
    return callDestination ? [callDestination, ...pois.filter((poi) => poi !== callDestination)] : pois;
  }, [pois, callDestinationPoiId]);

  // Capability filter (e.g. Cath Lab when a crew asks to divert a STEMI): only POIs offering every selected capability.
  // It starts empty each time the sheet opens.
  const [capabilityFilter, setCapabilityFilter] = useState<string[]>([]);
  useEffect(() => {
    if (!isOpen) setCapabilityFilter([]);
  }, [isOpen]);
  const capabilityOptions = useMemo(() => getPoiCapabilityOptions(pois), [pois]);
  const filteredPois = useMemo(() => filterPoisByCapabilities(orderedPois, capabilityFilter), [orderedPois, capabilityFilter]);
  const toggleCapability = (capability: string) => setCapabilityFilter((current) => (current.includes(capability) ? current.filter((c) => c !== capability) : [...current, capability]));

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="flex-1 rounded-t-2xl bg-white px-4 pb-6 dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1" space="sm">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('dispatch.unit_actions_panel.destination')}</Text>

          {/* No Destination Option */}
          <DestinationSheetOption type="none" isSelected={effectiveDestinationType === 'none'} onSelect={() => onSelect('none')} label={t('dispatch.unit_actions_panel.no_destination')} />

          {/* Tabs for Calls and Stations */}
          {capabilities.showCalls || capabilities.showStations || capabilities.showPois ? (
            <>
              <HStack className="rounded-lg bg-gray-100 p-1 dark:bg-gray-800" space="xs">
                {capabilities.showCalls ? (
                  <Pressable onPress={() => onTabChange('calls')} className={`flex-1 rounded-md px-3 py-2 ${activeTab === 'calls' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                    <Text className={`text-center text-sm font-medium ${activeTab === 'calls' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {callsLabel} ({calls.length})
                    </Text>
                  </Pressable>
                ) : null}
                {capabilities.showStations ? (
                  <Pressable onPress={() => onTabChange('stations')} className={`flex-1 rounded-md px-3 py-2 ${activeTab === 'stations' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                    <Text className={`text-center text-sm font-medium ${activeTab === 'stations' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('dispatch.stations')} ({stations.length})
                    </Text>
                  </Pressable>
                ) : null}
                {capabilities.showPois ? (
                  <Pressable onPress={() => onTabChange('pois')} className={`flex-1 rounded-md px-3 py-2 ${activeTab === 'pois' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
                    <Text className={`text-center text-sm font-medium ${activeTab === 'pois' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('menu.pois')} ({pois.length})
                    </Text>
                  </Pressable>
                ) : null}
              </HStack>

              {/* Tab Content */}
              <ScrollView className="flex-1 pb-5" showsVerticalScrollIndicator>
                {/* Calls Tab Content */}
                {activeTab === 'calls' && capabilities.showCalls ? (
                  <VStack space="xs">
                    {calls.length > 0 ? (
                      calls.map((call) => (
                        <DestinationSheetOption
                          key={call.CallId}
                          type="call"
                          item={call}
                          isSelected={effectiveDestinationType === 'call' && selectedCall?.CallId === call.CallId}
                          onSelect={() => onSelect('call', call)}
                        />
                      ))
                    ) : (
                      <Text className="py-8 text-center text-sm text-gray-400">{t('dispatch.unit_actions_panel.no_active_calls')}</Text>
                    )}
                  </VStack>
                ) : null}

                {/* Stations Tab Content */}
                {activeTab === 'stations' && capabilities.showStations ? (
                  <VStack space="xs">
                    {stations.length > 0 ? (
                      stations.map((station) => (
                        <DestinationSheetOption
                          key={station.GroupId}
                          type="station"
                          item={station}
                          isSelected={effectiveDestinationType === 'station' && selectedStation?.GroupId === station.GroupId}
                          onSelect={() => onSelect('station', station)}
                        />
                      ))
                    ) : (
                      <Text className="py-8 text-center text-sm text-gray-400">{t('dispatch.unit_actions_panel.no_stations_available')}</Text>
                    )}
                  </VStack>
                ) : null}

                {activeTab === 'pois' && capabilities.showPois ? (
                  <VStack space="xs">
                    {capabilityOptions.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
                        <HStack space="xs">
                          {capabilityOptions.map((capability) => {
                            const isActive = capabilityFilter.includes(capability);
                            return (
                              <Pressable
                                key={capability}
                                testID={`capability-chip-${capability}`}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                                onPress={() => toggleCapability(capability)}
                                className={`rounded-full border px-3 py-1 ${isActive ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}
                              >
                                <Text className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{capability}</Text>
                              </Pressable>
                            );
                          })}
                        </HStack>
                      </ScrollView>
                    ) : null}
                    {filteredPois.length > 0 ? (
                      filteredPois.map((poi) => (
                        <DestinationSheetOption
                          key={poi.PoiId}
                          type="poi"
                          item={poi}
                          isSelected={effectiveDestinationType === 'poi' && selectedPoi?.PoiId === poi.PoiId}
                          onSelect={() => onSelect('poi', poi)}
                          hint={poi.PoiId === callDestinationPoiId ? t('dispatch.unit_actions_panel.call_destination') : undefined}
                          detail={poi.Capabilities && poi.Capabilities.length > 0 ? poi.Capabilities.join(' · ') : undefined}
                        />
                      ))
                    ) : orderedPois.length > 0 ? (
                      <VStack className="items-center py-8" space="sm">
                        <Text className="text-center text-sm text-gray-400">{t('dispatch.unit_actions_panel.no_pois_match_capabilities')}</Text>
                        <Pressable onPress={() => setCapabilityFilter([])}>
                          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('dispatch.unit_actions_panel.clear_capability_filter')}</Text>
                        </Pressable>
                      </VStack>
                    ) : (
                      <Text className="py-8 text-center text-sm text-gray-400">{t('status.no_pois_available')}</Text>
                    )}
                  </VStack>
                ) : null}
              </ScrollView>
            </>
          ) : (
            <Text className="py-4 text-center text-gray-500 dark:text-gray-400">{t('dispatch.unit_actions_panel.no_destinations_available')}</Text>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

const styles = StyleSheet.create({
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: {
    maxHeight: 300,
  },
});
