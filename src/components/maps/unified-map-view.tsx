import Mapbox, { type CircleLayerStyle, type FillLayerStyle, type LineLayerStyle } from '@rnmapbox/maps';
import { type Feature, type FeatureCollection, type GeoJsonProperties, type Geometry } from 'geojson';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type GetMapLayersData } from '@/models/v4/mapping/getMapLayersResultData';
import { useLocationStore } from '@/stores/app/location-store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import MapPins from './map-pins';

interface UnifiedMapViewProps {
  /** Map pins to display */
  pins?: MapMakerInfoData[];
  /** Visible layers data to render */
  visibleLayers?: GetMapLayersData[];
  /** Whether to auto-fetch pins from API */
  autoFetchPins?: boolean;
  /** Callback when a pin is pressed */
  onPinPress?: (pin: MapMakerInfoData) => void;
  /** Callback when map is ready */
  onMapReady?: () => void;
  /** Whether to show user location */
  showUserLocation?: boolean;
  /** Whether to enable interaction */
  interactive?: boolean;
  /** Custom style overrides */
  style?: any;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Unified Map View component for iOS and Android using @rnmapbox/maps.
 * Supports pins, layers, and user location.
 */
export const UnifiedMapView: React.FC<UnifiedMapViewProps> = ({
  pins: externalPins,
  visibleLayers = [],
  autoFetchPins = false,
  onPinPress,
  onMapReady,
  showUserLocation = true,
  interactive = true,
  style,
  testID = 'unified-map-view',
}) => {
  const { colorScheme } = useColorScheme();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [internalPins, setInternalPins] = useState<MapMakerInfoData[]>([]);
  const lastUpdateTimestamp = useSignalRStore((state) => state.lastUpdateTimestamp);
  const signalRDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalRAbortController = useRef<AbortController | null>(null);

  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const location = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  // Use external pins if provided, otherwise use internal pins
  const mapPins = externalPins ?? internalPins;

  // Get map style based on current theme
  const getMapStyle = useCallback(() => {
    return colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;
  }, [colorScheme]);

  const [styleURL, setStyleURL] = useState({ styleURL: getMapStyle() });

  // Update map style when theme changes
  useEffect(() => {
    const newStyle = getMapStyle();
    setStyleURL({ styleURL: newStyle });
  }, [getMapStyle]);

  // Helper function to calculate center from markers
  const calculateCenterFromMarkers = (markers: MapMakerInfoData[]): { lat: number; lon: number } | null => {
    const validMarkers = markers.filter((m) => m.Latitude && m.Longitude);
    if (validMarkers.length === 0) return null;

    const sumLat = validMarkers.reduce((sum, m) => sum + m.Latitude, 0);
    const sumLon = validMarkers.reduce((sum, m) => sum + m.Longitude, 0);

    return {
      lat: sumLat / validMarkers.length,
      lon: sumLon / validMarkers.length,
    };
  };

  // Auto-fetch pins if enabled
  useEffect(() => {
    if (!autoFetchPins) return;

    const abortController = new AbortController();

    const fetchMapDataAndMarkers = async () => {
      try {
        const mapDataAndMarkers = await getMapDataAndMarkers(abortController.signal);

        if (mapDataAndMarkers?.Data) {
          const markers = mapDataAndMarkers.Data.MapMakerInfos;
          setInternalPins(markers);

          // Center map on the data center if provided
          if (mapDataAndMarkers.Data.CenterLat && mapDataAndMarkers.Data.CenterLon && cameraRef.current) {
            const centerLat = parseFloat(mapDataAndMarkers.Data.CenterLat);
            const centerLon = parseFloat(mapDataAndMarkers.Data.CenterLon);
            const zoomLevel = mapDataAndMarkers.Data.ZoomLevel ? parseFloat(mapDataAndMarkers.Data.ZoomLevel) : 12;

            if (!isNaN(centerLat) && !isNaN(centerLon)) {
              cameraRef.current.setCamera({
                centerCoordinate: [centerLon, centerLat],
                zoomLevel,
                animationDuration: 1000,
              });
            }
          } else if (markers.length > 0 && cameraRef.current) {
            // Fallback: Calculate center from markers if CenterLat/CenterLon not provided
            const center = calculateCenterFromMarkers(markers);
            if (center) {
              const zoomLevel = mapDataAndMarkers.Data.ZoomLevel ? parseFloat(mapDataAndMarkers.Data.ZoomLevel) : 12;
              cameraRef.current.setCamera({
                centerCoordinate: [center.lon, center.lat],
                zoomLevel: isNaN(zoomLevel) ? 12 : zoomLevel,
                animationDuration: 1000,
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
          return;
        }

        logger.error({
          message: 'Failed to fetch map data',
          context: { error },
        });
      }
    };

    fetchMapDataAndMarkers();

    return () => {
      abortController.abort();
    };
  }, [autoFetchPins]);

  // Refresh pins when SignalR updates come in (only when autoFetchPins is enabled)
  useEffect(() => {
    if (!autoFetchPins || lastUpdateTimestamp <= 0) return;

    // Clear any existing debounce timer
    if (signalRDebounceTimer.current) {
      clearTimeout(signalRDebounceTimer.current);
    }

    // Debounce to prevent rapid consecutive API calls from multiple SignalR events
    signalRDebounceTimer.current = setTimeout(async () => {
      // Abort any in-flight SignalR-triggered fetch
      if (signalRAbortController.current) {
        signalRAbortController.current.abort();
      }
      const controller = new AbortController();
      signalRAbortController.current = controller;

      try {
        logger.debug({
          message: 'Refreshing map pins from SignalR update',
          context: { timestamp: lastUpdateTimestamp },
        });

        const mapDataAndMarkers = await getMapDataAndMarkers(controller.signal);
        if (!controller.signal.aborted && mapDataAndMarkers?.Data) {
          setInternalPins(mapDataAndMarkers.Data.MapMakerInfos);
        }
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
          return;
        }
        logger.error({
          message: 'Failed to refresh map pins from SignalR update',
          context: { error },
        });
      }
    }, 1500);

    return () => {
      if (signalRDebounceTimer.current) {
        clearTimeout(signalRDebounceTimer.current);
      }
      if (signalRAbortController.current) {
        signalRAbortController.current.abort();
      }
    };
  }, [autoFetchPins, lastUpdateTimestamp]);

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
      return {
        fillColor: color,
        fillOpacity: 0.3,
        fillOutlineColor: color,
      } as FillLayerStyle;
    }
  };

  // Render map layers
  const renderMapLayers = () => {
    return visibleLayers.map((layer) => {
      if (!layer.Data?.Features || !Array.isArray(layer.Data.Features) || layer.Data.Features.length === 0) {
        return null;
      }

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

  const handleMapReady = () => {
    setIsMapReady(true);
    onMapReady?.();
  };

  // Initial camera position
  const initialCenter: [number, number] = location.longitude && location.latitude ? [location.longitude, location.latitude] : [-98.5795, 39.8283];

  return (
    <View style={StyleSheet.flatten([styles.container, style])} testID={testID}>
      <Mapbox.MapView
        ref={mapRef}
        styleURL={styleURL.styleURL}
        style={styles.map}
        onDidFinishLoadingMap={handleMapReady}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
      >
        <Mapbox.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: location.latitude && location.longitude ? 12 : 3 }} />

        {/* Render custom layers */}
        {renderMapLayers()}

        {/* User location */}
        {showUserLocation ? <Mapbox.UserLocation visible animated /> : null}

        {/* Map pins */}
        <MapPins pins={mapPins} onPinPress={onPinPress} />
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default UnifiedMapView;
