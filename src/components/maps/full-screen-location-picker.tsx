import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { MapPinIcon, XIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDepartmentMapStyle } from '@/lib/map-style';

interface FullScreenLocationPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  onLocationSelected: (location: { latitude: number; longitude: number; address?: string }) => void;
  onClose: () => void;
}

const FullScreenLocationPicker: React.FC<FullScreenLocationPickerProps> = ({ initialLocation, onLocationSelected, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(true);
  // Department base map (day/night by theme)
  const mapStyle = useDepartmentMapStyle();

  const reverseGeocode = React.useCallback(
    async (latitude: number, longitude: number) => {
      if (!isMounted) return;

      setIsReverseGeocoding(true);
      try {
        const result = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (!isMounted) return;

        if (result && result.length > 0) {
          const { street, name, city, region, country, postalCode } = result[0];
          let addressParts = [];

          if (street) addressParts.push(street);
          if (name && name !== street) addressParts.push(name);
          if (city) addressParts.push(city);
          if (region) addressParts.push(region);
          if (postalCode) addressParts.push(postalCode);
          if (country) addressParts.push(country);

          setAddress(addressParts.join(', '));
        } else {
          setAddress(undefined);
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
        if (isMounted) setAddress(undefined);
      } finally {
        if (isMounted) setIsReverseGeocoding(false);
      }
    },
    [isMounted]
  );

  const getUserLocation = React.useCallback(async () => {
    if (!isMounted) return;

    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        if (isMounted) setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      if (!isMounted) return;

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(newLocation);
      reverseGeocode(newLocation.latitude, newLocation.longitude);

      // Move camera to user location
      if (cameraRef.current && isMounted) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.coords.longitude, location.coords.latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      if (isMounted) setIsLoading(false);
    }
  }, [isMounted, reverseGeocode]);

  useEffect(() => {
    setIsMounted(true);

    if (initialLocation) {
      setCurrentLocation(initialLocation);
      reverseGeocode(initialLocation.latitude, initialLocation.longitude);
    } else {
      getUserLocation();
    }

    return () => {
      setIsMounted(false);
    };
  }, [initialLocation, getUserLocation, reverseGeocode]);

  const handleMapPress = (event: any) => {
    const { coordinates } = event.geometry;
    const newLocation = {
      latitude: coordinates[1],
      longitude: coordinates[0],
    };
    setCurrentLocation(newLocation);
    reverseGeocode(newLocation.latitude, newLocation.longitude);
  };

  const handleConfirmLocation = () => {
    if (currentLocation) {
      onLocationSelected({
        ...currentLocation,
        address,
      });
      onClose();
    }
  };

  if (isLoading) {
    return (
      <Box style={styles.container} className="items-center justify-center bg-gray-200">
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box style={styles.container}>
      {currentLocation ? (
        <Mapbox.MapView ref={mapRef} style={styles.map} styleURL={mapStyle} logoEnabled={false} attributionEnabled={true} compassEnabled={true} zoomEnabled={true} rotateEnabled={true} onPress={handleMapPress}>
          <Mapbox.Camera ref={cameraRef} zoomLevel={15} centerCoordinate={[currentLocation.longitude, currentLocation.latitude]} animationMode="flyTo" animationDuration={1000} />
          {/* Marker for the selected location */}
          <Mapbox.PointAnnotation id="selectedLocation" coordinate={[currentLocation.longitude, currentLocation.latitude]} title="Selected Location">
            <Box className="items-center justify-center">
              <MapPinIcon size={36} color="#FF0000" />
            </Box>
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

      {/* Close button */}
      <TouchableOpacity style={StyleSheet.flatten([styles.closeButton, { top: insets.top + 10 }])} onPress={onClose}>
        <XIcon size={24} color="#000000" />
      </TouchableOpacity>

      {/* Location info and confirm button */}
      <Box style={StyleSheet.flatten([styles.bottomPanel, { paddingBottom: insets.bottom + 16 }])} className="bg-white p-4 shadow-lg">
        {isReverseGeocoding ? (
          <Text className="mb-2 text-gray-500">{t('common.loading_address')}</Text>
        ) : address ? (
          <Text className="mb-2 text-gray-700">{address}</Text>
        ) : (
          <Text className="mb-2 text-gray-500">{t('common.no_address_found')}</Text>
        )}

        {currentLocation && (
          <Text className="mb-4 text-gray-500">
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        )}

        <Button onPress={handleConfirmLocation} disabled={!currentLocation}>
          <ButtonText>{t('common.set_location')}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});

export default FullScreenLocationPicker;
