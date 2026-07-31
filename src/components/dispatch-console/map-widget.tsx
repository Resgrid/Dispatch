import { Expand, Layers, Map as MapIcon, Navigation, RefreshCw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text as RNText, TouchableOpacity, View } from 'react-native';

import UnifiedMapView from '@/components/maps/unified-map-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MapLayerType, useMapLayers } from '@/hooks/use-map-layers';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';

import { PanelHeader } from './panel-header';

interface MapWidgetProps {
  /** Map pins to display */
  pins?: MapMakerInfoData[];
  /** Callback when expand button is pressed */
  onExpandMap?: () => void;
  /** Callback when refresh button is pressed */
  onRefresh?: () => void;
  /** Callback when center on location button is pressed */
  onCenterOnLocation?: () => void;
  /** Callback when a pin is pressed */
  onPinPress?: (pin: MapMakerInfoData) => void;
  /** Whether to auto-fetch pins from API */
  autoFetchPins?: boolean;
  /** Children to render inside the map container (for custom map implementations) */
  children?: React.ReactNode;
}

export const MapWidget: React.FC<MapWidgetProps> = ({ pins, onExpandMap, onRefresh, onCenterOnLocation, onPinPress, autoFetchPins = true, children }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('map'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);

  // Map layers hook
  const { layers, visibleLayers, isLoading: isLayersLoading, toggleLayer, showAllLayers, hideAllLayers, getVisibleLayerData } = useMapLayers({ initialLayerType: MapLayerType.ALL, autoFetch: true });

  const isDark = colorScheme === 'dark';

  // Render layers panel modal
  const renderLayersPanel = () => {
    return (
      <Modal visible={isLayersPanelOpen} transparent animationType="slide" onRequestClose={() => setIsLayersPanelOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.flatten([styles.layersPanelContainer, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }])}>
            <View style={styles.layersPanelHeader}>
              <RNText style={StyleSheet.flatten([styles.layersPanelTitle, { color: isDark ? '#ffffff' : '#000000' }])}>{t('map.layers')}</RNText>
              <TouchableOpacity onPress={() => setIsLayersPanelOpen(false)} style={styles.closeButton}>
                <RNText style={StyleSheet.flatten([styles.closeButtonText, { color: isDark ? '#9ca3af' : '#6b7280' }])}>✕</RNText>
              </TouchableOpacity>
            </View>

            <View style={styles.layersPanelActions}>
              <TouchableOpacity onPress={showAllLayers} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }])}>
                <RNText style={StyleSheet.flatten([styles.actionButtonText, { color: isDark ? '#ffffff' : '#000000' }])}>{t('map.show_all')}</RNText>
              </TouchableOpacity>
              <TouchableOpacity onPress={hideAllLayers} style={StyleSheet.flatten([styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }])}>
                <RNText style={StyleSheet.flatten([styles.actionButtonText, { color: isDark ? '#ffffff' : '#000000' }])}>{t('map.hide_all')}</RNText>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.layersList}>
              {layers.length === 0 ? (
                <RNText style={StyleSheet.flatten([styles.noLayersText, { color: isDark ? '#9ca3af' : '#6b7280' }])}>{isLayersLoading ? t('common.loading') : t('map.no_layers')}</RNText>
              ) : (
                layers.map((layer) => (
                  <Pressable key={layer.Id} style={StyleSheet.flatten([styles.layerItem, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }])} onPress={() => toggleLayer(layer.Id)}>
                    <View style={styles.layerInfo}>
                      <View style={StyleSheet.flatten([styles.layerColorIndicator, { backgroundColor: layer.Color || '#3b82f6' }])} />
                      <RNText style={StyleSheet.flatten([styles.layerName, { color: isDark ? '#ffffff' : '#000000' }])} numberOfLines={1}>
                        {layer.Name}
                      </RNText>
                    </View>
                    <Switch
                      value={visibleLayers.has(layer.Id)}
                      onValueChange={() => toggleLayer(layer.Id)}
                      trackColor={{ false: isDark ? '#4b5563' : '#d1d5db', true: '#3b82f6' }}
                      thumbColor={visibleLayers.has(layer.Id) ? '#ffffff' : '#f4f3f4'}
                    />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Box className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}>
        <PanelHeader
          title={t('dispatch.map')}
          icon={MapIcon}
          iconColor="#14b8a6"
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setCardCollapsed('map', !isCollapsed)}
          rightContent={
            <HStack space="xs">
              {onRefresh ? (
                <Pressable onPress={onRefresh} style={styles.iconButton}>
                  <Icon as={RefreshCw} size="xs" className="text-gray-500 dark:text-gray-400" />
                </Pressable>
              ) : null}
              {onCenterOnLocation ? (
                <Pressable onPress={onCenterOnLocation} style={styles.iconButton}>
                  <Icon as={Navigation} size="xs" className="text-gray-500 dark:text-gray-400" />
                </Pressable>
              ) : null}
              <Pressable onPress={() => setIsLayersPanelOpen(true)} style={styles.iconButton}>
                <Icon as={Layers} size="xs" className="text-gray-500 dark:text-gray-400" />
              </Pressable>
              {onExpandMap ? (
                <Pressable onPress={onExpandMap} style={styles.iconButton}>
                  <Icon as={Expand} size="xs" className="text-indigo-500" />
                </Pressable>
              ) : null}
            </HStack>
          }
        />

        {!isCollapsed ? (
          <View style={styles.mapContainer}>
            {children ? (
              children
            ) : (
              <UnifiedMapView pins={pins} visibleLayers={getVisibleLayerData()} autoFetchPins={autoFetchPins} onPinPress={onPinPress} showUserLocation={true} interactive={true} testID="map-widget-view" />
            )}
          </View>
        ) : null}
      </Box>

      {/* Layers Panel Modal */}
      {renderLayersPanel()}
    </>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    minHeight: 200,
    maxHeight: 350,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  iconButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  layersPanelContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  layersPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  layersPanelTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  layersPanelActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  layersList: {
    paddingHorizontal: 16,
  },
  layerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  layerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  layerColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  layerName: {
    fontSize: 14,
    flex: 1,
  },
  noLayersText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
});
