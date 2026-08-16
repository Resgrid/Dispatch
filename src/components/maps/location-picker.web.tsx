import mapboxgl from 'mapbox-gl';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { Env } from '@/lib/env';
import { getDepartmentMapCenter } from '@/lib/map-center';

// Mapbox GL CSS needs to be injected for web
const MAPBOX_GL_CSS_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);

  // Inject Mapbox GL CSS
  useEffect(() => {
    if (!document.getElementById('mapbox-gl-css')) {
      const link = document.createElement('link');
      link.id = 'mapbox-gl-css';
      link.href = MAPBOX_GL_CSS_URL;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  const getUserLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCurrentLocation(newLocation);

            // Move map to user location
            if (map.current) {
              map.current.flyTo({
                center: [newLocation.longitude, newLocation.latitude],
                zoom: 15,
              });
            }

            // Update marker
            if (marker.current) {
              marker.current.setLngLat([newLocation.longitude, newLocation.latitude]);
            } else if (map.current) {
              marker.current = new mapboxgl.Marker({ color: '#FF0000' }).setLngLat([newLocation.longitude, newLocation.latitude]).addTo(map.current);
            }

            setIsLoading(false);
          },
          (error) => {
            console.error('Error getting location:', error);
            setIsLoading(false);
          }
        );
      } else {
        console.error('Geolocation not supported');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setIsLoading(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    mapboxgl.accessToken = Env.MAPBOX_PUBKEY;

    // Read once: two calls are two store reads, and the second could see a different config.
    const departmentCenter = getDepartmentMapCenter();
    const initialCenter: [number, number] = currentLocation ? [currentLocation.longitude, currentLocation.latitude] : [departmentCenter.longitude, departmentCenter.latitude];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      // The department configured a zoom to go with its center; a fixed 3 opens on the whole globe.
      zoom: currentLocation ? 15 : departmentCenter.zoomLevel,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Create initial marker if we have a location
    if (currentLocation) {
      marker.current = new mapboxgl.Marker({ color: '#FF0000' }).setLngLat([currentLocation.longitude, currentLocation.latitude]).addTo(map.current);
    }

    // Handle map click
    map.current.on('click', (e) => {
      const newLocation = {
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      };
      setCurrentLocation(newLocation);

      // Update or create marker
      if (marker.current) {
        marker.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      } else if (map.current) {
        marker.current = new mapboxgl.Marker({ color: '#FF0000' }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(map.current);
      }
    });

    // If no initial location, get user location
    if (!currentLocation) {
      getUserLocation();
    }

    return () => {
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmLocation = () => {
    if (currentLocation) {
      onLocationSelected(currentLocation);
    }
  };

  if (isLoading) {
    return (
      <View style={StyleSheet.flatten([styles.container, { height }])}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={StyleSheet.flatten([styles.container, { height }])}>
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
      {!currentLocation ? (
        <View style={styles.noLocationContainer}>
          <Text style={styles.noLocationText}>{t('common.no_location')}</Text>
          <Pressable onPress={getUserLocation}>
            <Text style={styles.getLocationText}>{t('common.get_my_location')}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.buttonContainer}>
        <Button onPress={handleConfirmLocation} disabled={!currentLocation}>
          <ButtonText>{t('common.confirm_location')}</ButtonText>
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  loadingText: {
    color: '#6b7280',
  },
  noLocationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 231, 235, 0.9)',
  },
  noLocationText: {
    color: '#6b7280',
  },
  getLocationText: {
    color: '#3b82f6',
    marginTop: 8,
  },
  buttonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
});

export default LocationPicker;
