import Mapbox, { type CircleLayerStyle, type FillLayerStyle, type LineLayerStyle } from '@rnmapbox/maps';
import { Stack, useFocusEffect } from 'expo-router';
import { type Feature, type FeatureCollection, type GeoJsonProperties, type Geometry } from 'geojson';
import { LayersIcon, NavigationIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import MapPins from '@/components/maps/map-pins';
import PinDetailModal from '@/components/maps/pin-detail-modal';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { useActiveMapLayers } from '@/hooks/use-active-map-layers';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { MapLayerType, useMapLayers } from '@/hooks/use-map-layers';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { createDefaultVisiblePoiLayerIds, filterMapPinsByPoiLayers, getPoiMapLayerId } from '@/lib/poi-map-layers';
import { onSortOptions } from '@/lib/utils';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type GetMapLayersData } from '@/models/v4/mapping/getMapLayersResultData';
import { type PoiLayerData } from '@/models/v4/mapping/poiLayerData';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

Mapbox.setAccessToken(Env.MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapMakerInfoData[]>([]);
  const [poiLayers, setPoiLayers] = useState<PoiLayerData[]>([]);
  const [visiblePoiLayerIds, setVisiblePoiLayerIds] = useState<Set<string>>(new Set());
  const [selectedPin, setSelectedPin] = useState<MapMakerInfoData | null>(null);
  const [isPinDetailModalOpen, setIsPinDetailModalOpen] = useState(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const { isActive } = useAppLifecycle();
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const heading = useLocationStore((state) => state.heading);
  const isMapLocked = useLocationStore((state) => state.isMapLocked);
  const location = useMemo(() => ({ latitude, longitude, heading, isMapLocked }), [latitude, longitude, heading, isMapLocked]);

  // Map layers hook
  const { layers, visibleLayers, isLoading: isLayersLoading, fetchLayers, toggleLayer, showAllLayers, hideAllLayers, getVisibleLayerData } = useMapLayers({ initialLayerType: MapLayerType.ALL, autoFetch: true });

  // Custom-map region layers (RE1-T105) rendered on top of the legacy vector layers.
  const { activeLayers } = useActiveMapLayers();

  const _mapOptions = Object.keys(Mapbox.StyleURL)
    .map((key) => {
      return {
        label: key,
        data: (Mapbox.StyleURL as any)[key],
      };
    })
    .sort(onSortOptions);

  // Get map style based on current theme
  const getMapStyle = useCallback(() => {
    return colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;
  }, [colorScheme]);

  const [styleURL, setStyleURL] = useState({ styleURL: getMapStyle() });

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const syncPoiLayers = useCallback((nextPoiLayers: PoiLayerData[]) => {
    setPoiLayers(nextPoiLayers);
    setVisiblePoiLayerIds(createDefaultVisiblePoiLayerIds(nextPoiLayers));
  }, []);

  useMapSignalRUpdates(setMapPins, syncPoiLayers);

  const togglePoiLayer = useCallback((layerId: string) => {
    setVisiblePoiLayerIds((currentLayerIds) => {
      const nextLayerIds = new Set(currentLayerIds);

      if (nextLayerIds.has(layerId)) {
        nextLayerIds.delete(layerId);
      } else {
        nextLayerIds.add(layerId);
      }

      return nextLayerIds;
    });
  }, []);

  const showAllMapLayers = useCallback(() => {
    showAllLayers();
    setVisiblePoiLayerIds(createDefaultVisiblePoiLayerIds(poiLayers));
  }, [poiLayers, showAllLayers]);

  const hideAllMapLayers = useCallback(() => {
    hideAllLayers();
    setVisiblePoiLayerIds(new Set());
  }, [hideAllLayers]);

  const combinedLayers = useMemo(
    () => [
      ...layers.map((layer) => ({ Id: layer.Id, Name: layer.Name, Color: layer.Color, kind: 'custom' as const })),
      ...poiLayers.map((layer) => ({ Id: getPoiMapLayerId(layer.PoiTypeId), Name: layer.Name, Color: layer.Color, kind: 'poi' as const })),
    ],
    [layers, poiLayers]
  );

  const visibleMapPins = useMemo(() => filterMapPinsByPoiLayers(mapPins, visiblePoiLayerIds), [mapPins, visiblePoiLayerIds]);

  // Update map style when theme changes
  useEffect(() => {
    const newStyle = getMapStyle();
    setStyleURL({ styleURL: newStyle });
  }, [getMapStyle]);

  // Handle navigation focus - reset map state when user navigates back to map page
  useFocusEffect(
    useCallback(() => {
      // Reset hasUserMovedMap when navigating back to map
      setHasUserMovedMap(false);

      // Refresh layers when map is focused
      fetchLayers();

      // Reset camera to current location when navigating back to map
      if (isMapReady && location.latitude && location.longitude) {
        const cameraConfig: any = {
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: location.isMapLocked ? 16 : 12,
          animationDuration: 1000,
          heading: 0,
          pitch: 0,
        };

        // Add heading and pitch for navigation mode when locked
        if (location.isMapLocked && location.heading !== null && location.heading !== undefined) {
          cameraConfig.heading = location.heading;
          cameraConfig.pitch = 45;
        }

        cameraRef.current?.setCamera(cameraConfig);

        logger.info({
          message: 'Map focused, resetting camera to current location',
          context: {
            // GDPR: log bucketed (~11km) coordinates instead of verbatim position
            latitudeBucket: Math.round(location.latitude * 10) / 10,
            longitudeBucket: Math.round(location.longitude * 10) / 10,
            isMapLocked: location.isMapLocked,
            gdpr: { purpose: 'map_tracking', lawful_basis: 'consent' },
          },
        });
      }
    }, [isMapReady, location.latitude, location.longitude, location.isMapLocked, location.heading, fetchLayers])
  );

  useEffect(() => {
    if (isMapReady && location.latitude && location.longitude) {
      // When map is locked, always follow the location
      // When map is unlocked, only follow if user hasn't moved the map
      if (location.isMapLocked || !hasUserMovedMap) {
        logger.info({
          message: 'Location updated and map is ready',
          context: {
            // GDPR: log bucketed (~11km) coordinates instead of verbatim position
            latitudeBucket: Math.round(location.latitude * 10) / 10,
            longitudeBucket: Math.round(location.longitude * 10) / 10,
            heading: location.heading,
            isMapLocked: location.isMapLocked,
            gdpr: { purpose: 'map_tracking', lawful_basis: 'consent' },
          },
        });

        const cameraConfig: any = {
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: location.isMapLocked ? 16 : 12,
          animationDuration: location.isMapLocked ? 500 : 1000,
        };

        // Add heading and pitch for navigation mode when locked
        if (location.isMapLocked && location.heading !== null && location.heading !== undefined) {
          cameraConfig.heading = location.heading;
          cameraConfig.pitch = 45;
        }

        cameraRef.current?.setCamera(cameraConfig);
      }
    }
  }, [isMapReady, location.latitude, location.longitude, location.heading, location.isMapLocked, hasUserMovedMap]);

  // Reset hasUserMovedMap when map gets locked and reset camera when unlocked
  useEffect(() => {
    if (location.isMapLocked) {
      setHasUserMovedMap(false);
    } else {
      // When exiting locked mode, reset camera to normal view and reset user interaction state
      setHasUserMovedMap(false);

      if (isMapReady && location.latitude && location.longitude) {
        cameraRef.current?.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: 12,
          heading: 0,
          pitch: 0,
          animationDuration: 1000,
        });
        logger.info({
          message: 'Map unlocked, resetting camera to normal view and user interaction state',
          context: {
            // GDPR: log bucketed (~11km) coordinates instead of verbatim position
            latitudeBucket: Math.round(location.latitude * 10) / 10,
            longitudeBucket: Math.round(location.longitude * 10) / 10,
            gdpr: { purpose: 'map_tracking', lawful_basis: 'consent' },
          },
        });
      }
    }
  }, [isMapReady, location.isMapLocked, location.latitude, location.longitude]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchMapDataAndMarkers = async () => {
      try {
        const mapDataAndMarkers = await getMapDataAndMarkers(abortController.signal);

        if (mapDataAndMarkers && mapDataAndMarkers.Data) {
          setMapPins(mapDataAndMarkers.Data.MapMakerInfos);
          syncPoiLayers(mapDataAndMarkers.Data.PoiLayers ?? []);
        }
      } catch (error) {
        // Don't log aborted requests as errors
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
          logger.debug({
            message: 'Map data fetch was aborted during component unmount',
          });
          return;
        }

        logger.error({
          message: 'Failed to fetch initial map data and markers',
          context: { error },
        });
      }
    };

    fetchMapDataAndMarkers();

    // Cleanup function to abort request if component unmounts
    return () => {
      abortController.abort();
    };
  }, [syncPoiLayers]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Track when map view is rendered
  useEffect(() => {
    trackEvent('map_view_rendered', {
      hasMapPins: mapPins.length > 0,
      mapPinsCount: mapPins.length,
      isMapLocked: location.isMapLocked,
      theme: colorScheme || 'light',
      layersCount: combinedLayers.length,
      visibleLayersCount: visibleLayers.size + visiblePoiLayerIds.size,
    });
  }, [trackEvent, mapPins.length, location.isMapLocked, colorScheme, combinedLayers.length, visibleLayers.size, visiblePoiLayerIds.size]);

  const onCameraChanged = (event: any) => {
    // Only register user interaction if map is not locked
    if (event.properties.isUserInteraction && !location.isMapLocked) {
      setHasUserMovedMap(true);
    }
  };

  const handleRecenterMap = () => {
    if (location.latitude && location.longitude) {
      const cameraConfig: any = {
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: location.isMapLocked ? 16 : 12,
        animationDuration: 1000,
      };

      // Add heading and pitch for navigation mode when locked
      if (location.isMapLocked && location.heading !== null && location.heading !== undefined) {
        cameraConfig.heading = location.heading;
        cameraConfig.pitch = 45;
      }

      cameraRef.current?.setCamera(cameraConfig);
      setHasUserMovedMap(false);
    }
  };

  const handlePinPress = useCallback((pin: MapMakerInfoData) => {
    setSelectedPin(pin);
    setIsPinDetailModalOpen(true);
  }, []);

  const handleSetAsCurrentCall = async (pin: MapMakerInfoData) => {
    try {
      logger.info({
        message: 'Setting call as current call',
        context: {
          callId: pin.Id,
          callTitle: pin.Title,
        },
      });

      await useCoreStore.getState().setActiveCall(pin.Id);
      useToastStore.getState().showToast('success', t('map.call_set_as_current'));
    } catch (error) {
      logger.error({
        message: 'Failed to set call as current call',
        context: {
          error,
          callId: pin.Id,
          callTitle: pin.Title,
        },
      });

      useToastStore.getState().showToast('error', t('map.failed_to_set_current_call'));
    }
  };

  const handleClosePinDetail = () => {
    setIsPinDetailModalOpen(false);
    setSelectedPin(null);
  };

  // Show recenter button only when map is not locked and user has moved the map
  const showRecenterButton = !location.isMapLocked && hasUserMovedMap && location.latitude && location.longitude;

  // Create dynamic styles based on theme
  const getThemedStyles = useCallback(() => {
    const isDark = colorScheme === 'dark';
    return {
      markerInnerContainer: {
        width: 24,
        height: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: isDark ? '#1f2937' : '#ffffff',
        elevation: 5,
        shadowColor: isDark ? '#ffffff' : '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.1 : 0.25,
        shadowRadius: 3.84,
      },
      recenterButton: {
        position: 'absolute' as const,
        bottom: 20 + insets.bottom,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3b82f6',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        elevation: 5,
        shadowColor: isDark ? '#ffffff' : '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.1 : 0.25,
        shadowRadius: 3.84,
      },
      layersButton: {
        position: 'absolute' as const,
        bottom: 20 + insets.bottom,
        left: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: isDark ? '#374151' : '#ffffff',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        elevation: 5,
        shadowColor: isDark ? '#ffffff' : '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.1 : 0.25,
        shadowRadius: 3.84,
      },
    };
  }, [colorScheme, insets.bottom]);

  const themedStyles = getThemedStyles();

  // Helper function to get layer style based on type
  const getLayerStyle = (layer: GetMapLayersData): FillLayerStyle | LineLayerStyle | CircleLayerStyle => {
    const color = layer.Color || '#3b82f6';
    const type = layer.Data?.Type?.toLowerCase() || 'polygon';

    if (type === 'linestring' || type === 'multilinestring') {
      return {
        lineColor: color,
        lineWidth: 3,
        lineOpacity: 0.8,
      } as LineLayerStyle;
    } else if (type === 'point' || type === 'multipoint') {
      return {
        circleColor: color,
        circleRadius: 8,
        circleOpacity: 0.8,
        circleStrokeColor: '#ffffff',
        circleStrokeWidth: 2,
      } as CircleLayerStyle;
    } else {
      // Default to polygon/fill style
      return {
        fillColor: color,
        fillOpacity: 0.3,
        fillOutlineColor: color,
      } as FillLayerStyle;
    }
  };

  // Render map layers
  const renderMapLayers = () => {
    const visibleLayerData = getVisibleLayerData();

    return visibleLayerData.map((layer) => {
      if (!layer.Data?.Features || !Array.isArray(layer.Data.Features) || layer.Data.Features.length === 0) {
        return null;
      }

      // Build a proper GeoJSON FeatureCollection from the layer data
      const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: layer.Data.Features.flatMap((fc) => fc.features || []) as Feature<Geometry, GeoJsonProperties>[],
      };

      if (featureCollection.features.length === 0) {
        return null;
      }

      const layerStyle = getLayerStyle(layer);
      const type = layer.Data.Type?.toLowerCase() || 'polygon';

      return (
        <Mapbox.ShapeSource key={`layer-source-${layer.Id}`} id={`layer-source-${layer.Id}`} shape={featureCollection}>
          {type === 'linestring' || type === 'multilinestring' ? (
            <Mapbox.LineLayer id={`layer-line-${layer.Id}`} style={layerStyle as LineLayerStyle} />
          ) : type === 'point' || type === 'multipoint' ? (
            <Mapbox.CircleLayer id={`layer-circle-${layer.Id}`} style={layerStyle as CircleLayerStyle} />
          ) : (
            <Mapbox.FillLayer id={`layer-fill-${layer.Id}`} style={layerStyle as FillLayerStyle} />
          )}
        </Mapbox.ShapeSource>
      );
    });
  };

  // Render on-by-default custom-map region layers (GeoJSON) fetched via GetAllActiveLayers.
  const renderActiveCustomLayers = () => {
    return activeLayers.map((layer) => {
      if (!layer.data?.features || layer.data.features.length === 0) {
        return null;
      }
      return (
        <Mapbox.ShapeSource key={`active-source-${layer.id}`} id={`active-source-${layer.id}`} shape={layer.data as FeatureCollection}>
          <Mapbox.FillLayer id={`active-fill-${layer.id}`} style={{ fillColor: layer.color, fillOpacity: 0.25, fillOutlineColor: layer.color } as FillLayerStyle} />
          <Mapbox.LineLayer id={`active-line-${layer.id}`} style={{ lineColor: layer.color, lineWidth: 2, lineOpacity: 0.8 } as LineLayerStyle} />
        </Mapbox.ShapeSource>
      );
    });
  };

  // Render layers panel modal
  const renderLayersPanel = () => {
    const isDark = colorScheme === 'dark';

    return (
      <Modal visible={isLayersPanelOpen} transparent animationType="slide" onRequestClose={() => setIsLayersPanelOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.layersPanelContainer, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <View style={styles.layersPanelHeader}>
              <Text style={[styles.layersPanelTitle, { color: isDark ? '#ffffff' : '#000000' }]}>{t('map.layers')}</Text>
              <TouchableOpacity onPress={() => setIsLayersPanelOpen(false)} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.layersPanelActions}>
              <TouchableOpacity onPress={showAllMapLayers} style={[styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                <Text style={[styles.actionButtonText, { color: isDark ? '#ffffff' : '#000000' }]}>{t('map.show_all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={hideAllMapLayers} style={[styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                <Text style={[styles.actionButtonText, { color: isDark ? '#ffffff' : '#000000' }]}>{t('map.hide_all')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.layersList}>
              {combinedLayers.length === 0 ? (
                <Text style={[styles.noLayersText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{isLayersLoading ? t('common.loading') : t('map.no_layers')}</Text>
              ) : (
                combinedLayers.map((layer) => (
                  <Pressable key={layer.Id} style={[styles.layerItem, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]} onPress={() => (layer.kind === 'custom' ? toggleLayer(layer.Id) : togglePoiLayer(layer.Id))}>
                    <View style={styles.layerInfo}>
                      <View style={[styles.layerColorIndicator, { backgroundColor: layer.Color || '#3b82f6' }]} />
                      <Text style={[styles.layerName, { color: isDark ? '#ffffff' : '#000000' }]} numberOfLines={1}>
                        {layer.Name}
                      </Text>
                    </View>
                    <Switch
                      value={layer.kind === 'custom' ? visibleLayers.has(layer.Id) : visiblePoiLayerIds.has(layer.Id)}
                      onValueChange={() => (layer.kind === 'custom' ? toggleLayer(layer.Id) : togglePoiLayer(layer.Id))}
                      trackColor={{ false: isDark ? '#4b5563' : '#d1d5db', true: '#3b82f6' }}
                      thumbColor={(layer.kind === 'custom' ? visibleLayers.has(layer.Id) : visiblePoiLayerIds.has(layer.Id)) ? '#ffffff' : '#f4f3f4'}
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
      <Stack.Screen
        options={{
          title: t('tabs.map'),
          headerTitle: t('app.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1" testID="map-container">
        <FocusAwareStatusBar />
        <Mapbox.MapView
          ref={mapRef}
          styleURL={styleURL.styleURL}
          style={styles.map}
          onCameraChanged={onCameraChanged}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
          testID="map-view"
          scrollEnabled={!location.isMapLocked}
          zoomEnabled={!location.isMapLocked}
          rotateEnabled={!location.isMapLocked}
          pitchEnabled={!location.isMapLocked}
        >
          <Mapbox.Camera
            ref={cameraRef}
            followZoomLevel={location.isMapLocked ? 16 : 12}
            followUserLocation={location.isMapLocked}
            followUserMode={location.isMapLocked ? Mapbox.UserTrackingMode.FollowWithHeading : undefined}
            followPitch={location.isMapLocked ? 45 : undefined}
          />

          {/* Render custom layers */}
          {renderMapLayers()}
          {renderActiveCustomLayers()}

          {location.latitude && location.longitude ? (
            <Mapbox.PointAnnotation id="userLocation" coordinate={[location.longitude, location.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View
                style={[
                  styles.markerContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View style={styles.markerOuterRing} />
                <View style={[styles.markerInnerContainer, themedStyles.markerInnerContainer]}>
                  <View style={styles.markerDot} />
                  {location.heading !== null && location.heading !== undefined ? (
                    <View
                      style={[
                        styles.directionIndicator,
                        {
                          transform: [{ rotate: `${location.heading}deg` }],
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </Animated.View>
            </Mapbox.PointAnnotation>
          ) : null}
          <MapPins pins={visibleMapPins} onPinPress={handlePinPress} />
        </Mapbox.MapView>

        {/* Layers Button */}
        <TouchableOpacity style={[styles.layersButton, themedStyles.layersButton]} onPress={() => setIsLayersPanelOpen(true)} testID="layers-button">
          <LayersIcon size={20} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
        </TouchableOpacity>

        {/* Recenter Button - only show when map is not locked and user has moved the map */}
        {showRecenterButton ? (
          <TouchableOpacity style={[styles.recenterButton, themedStyles.recenterButton]} onPress={handleRecenterMap} testID="recenter-button">
            <NavigationIcon size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Layers Panel Modal */}
      {renderLayersPanel()}

      {/* Pin Detail Modal */}
      <PinDetailModal pin={selectedPin} isOpen={isPinDetailModalOpen} onClose={handleClosePinDetail} onSetAsCurrentCall={handleSetAsCurrentCall} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    position: 'relative',
  },
  markerOuterRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  markerInnerContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    borderWidth: 3,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  directionIndicator: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#3b82f6',
    top: -36,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  layersButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
