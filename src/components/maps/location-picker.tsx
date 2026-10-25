import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { DispatchMapLegend } from '@/components/maps/dispatch-map-legend';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { boundsAround, type DispatchMapOverlay } from '@/lib/dispatch-board';
import { useDepartmentMapStyle } from '@/lib/map-style';

interface LocationPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  /** Called with every pin move: a tap on the map is the new call location, with no confirm step to forget. */
  onLocationSelected: (location: { latitude: number; longitude: number; address?: string }) => void;
  height?: number;
  /** Units, personnel and group boundaries to show around the call (dispatching). */
  overlay?: DispatchMapOverlay | null;
}

const spotKey = (location: { latitude: number; longitude: number }) => `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelected, height = 200, overlay }) => {
  const { t } = useTranslation();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);
  // Department base map (day/night by theme)
  const mapStyle = useDepartmentMapStyle();
  // The call location the map was last framed for, so a refreshed board does not yank the view the dispatcher moved.
  const framedForRef = useRef<string | null>(null);

  // The first time there are resources around a call location, frame the call with the closest few.
  useEffect(() => {
    if (!currentLocation || !overlay?.nearest.length || !cameraRef.current) return;
    const framingKey = `${currentLocation.latitude.toFixed(5)},${currentLocation.longitude.toFixed(5)}`;
    if (framedForRef.current === framingKey) return;

    const bounds = boundsAround(currentLocation, overlay.nearest);
    if (bounds) {
      framedForRef.current = framingKey;
      // [top, right, bottom, left]: extra room at the bottom, where the Confirm Location bar sits over the map.
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, [48, 48, 96, 48], 600);
    }
  }, [overlay, currentLocation]);

  const getUserLocation = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Move camera to user location
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.coords.longitude, location.coords.latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
    } else {
      getUserLocation().catch((error) => {
        console.error('Failed to get user location:', error);
      });
    }
  }, [initialLocation, getUserLocation]);

  const handleMapPress = (event: any) => {
    const { coordinates } = event.geometry;
    const newLocation = {
      latitude: coordinates[1],
      longitude: coordinates[0],
    };
    setCurrentLocation(newLocation);
    // The dispatcher is already looking at the spot they tapped, so the board for it does not reframe the map.
    framedForRef.current = spotKey(newLocation);
    // The pin is the call location: the form, and the recipient picker's distances and ETAs, follow it at once.
    onLocationSelected(newLocation);
  };

  const handleConfirmLocation = () => {
    if (currentLocation) {
      onLocationSelected(currentLocation);
    }
  };

  if (isLoading) {
    return (
      <Box style={StyleSheet.flatten([styles.container, { height }])} className="items-center justify-center bg-gray-200">
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box style={StyleSheet.flatten([styles.container, { height }])}>
      {currentLocation ? (
        <Mapbox.MapView ref={mapRef} style={styles.map} styleURL={mapStyle} logoEnabled={false} attributionEnabled={false} compassEnabled={true} zoomEnabled={true} rotateEnabled={true} onPress={handleMapPress}>
          <Mapbox.Camera ref={cameraRef} zoomLevel={15} centerCoordinate={[currentLocation.longitude, currentLocation.latitude]} animationMode="flyTo" animationDuration={1000} />
          {overlay ? (
            <>
              <Mapbox.ShapeSource id="dispatchBoundaries" shape={overlay.boundaries}>
                <Mapbox.FillLayer id="dispatchBoundariesFill" style={{ fillColor: ['get', 'color'], fillOpacity: 0.08 }} />
                <Mapbox.LineLayer id="dispatchBoundariesLine" style={{ lineColor: ['get', 'color'], lineWidth: 2, lineOpacity: 0.85 }} />
              </Mapbox.ShapeSource>
              <Mapbox.ShapeSource id="dispatchResources" shape={overlay.points}>
                <Mapbox.CircleLayer
                  id="dispatchResourcesCircle"
                  style={{
                    circleRadius: ['case', ['==', ['get', 'kind'], 'unit'], 8, 6],
                    circleColor: ['get', 'color'],
                    circleStrokeColor: '#ffffff',
                    circleStrokeWidth: ['case', ['==', ['get', 'kind'], 'unit'], 2.5, 1.5],
                  }}
                />
                <Mapbox.SymbolLayer
                  id="dispatchResourcesLabel"
                  style={{ textField: ['get', 'name'], textSize: 11, textOffset: [0, 1.1], textAnchor: 'top', textOptional: true, textColor: '#111827', textHaloColor: '#ffffff', textHaloWidth: 1.5 }}
                />
              </Mapbox.ShapeSource>
            </>
          ) : null}
          {/* Marker for the selected location */}
          <Mapbox.PointAnnotation id="selectedLocation" coordinate={[currentLocation.longitude, currentLocation.latitude]} title="Selected Location">
            <Box />
          </Mapbox.PointAnnotation>
        </Mapbox.MapView>
      ) : (
        <Box className="items-center justify-center bg-gray-200" style={{ flex: 1 }}>
          <Text className="text-gray-500">{t('common.no_location')}</Text>
          <TouchableOpacity onPress={getUserLocation} className="mt-2">
            <Text className="text-blue-500">{t('common.get_my_location')}</Text>
          </TouchableOpacity>
        </Box>
      )}

      {overlay && currentLocation ? <DispatchMapLegend overlay={overlay} /> : null}

      {/* Taps commit as they happen; only a pin the map placed itself (the dispatcher's own position) waits for this. */}
      {currentLocation && (!initialLocation || spotKey(currentLocation) !== spotKey(initialLocation)) ? (
        <Box className="absolute inset-x-4 bottom-4">
          <Button onPress={handleConfirmLocation}>
            <ButtonText>{t('common.confirm_location')}</ButtonText>
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  map: {
    flex: 1,
  },
});

export default LocationPicker;
