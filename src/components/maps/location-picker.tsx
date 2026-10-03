import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDepartmentMapStyle } from '@/lib/map-style';

interface LocationPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  onLocationSelected: (location: { latitude: number; longitude: number; address?: string }) => void;
  height?: number;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelected, height = 200 }) => {
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
    setCurrentLocation({
      latitude: coordinates[1],
      longitude: coordinates[0],
    });
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

      <Box className="absolute inset-x-4 bottom-4">
        <Button onPress={handleConfirmLocation} disabled={!currentLocation}>
          <ButtonText>{t('common.confirm_location')}</ButtonText>
        </Button>
      </Box>
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
