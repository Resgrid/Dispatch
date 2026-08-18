import { MapPinIcon, XIcon } from 'lucide-react-native';
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  // getCurrentPosition can resolve after the picker closes; without this the callbacks
  // set state on an unmounted component.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    setIsReverseGeocoding(true);
    try {
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${Env.MAPBOX_PUBKEY}`);

      if (!response.ok) {
        const body = await response.text();
        console.error('Reverse geocoding failed:', { status: response.status, body });
        setAddress(undefined);
        return;
      }

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setAddress(data.features[0].place_name);
      } else {
        setAddress(undefined);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setAddress(undefined);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const getUserLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isMounted.current) return;
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCurrentLocation(newLocation);
            reverseGeocode(newLocation.latitude, newLocation.longitude);

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
              marker.current = new mapboxgl.Marker({ color: '#FF0000', draggable: true }).setLngLat([newLocation.longitude, newLocation.latitude]).addTo(map.current);
              marker.current.on('dragend', () => {
                const lngLat = marker.current?.getLngLat();
                if (lngLat) {
                  const draggedLocation = {
                    latitude: lngLat.lat,
                    longitude: lngLat.lng,
                  };
                  setCurrentLocation(draggedLocation);
                  reverseGeocode(draggedLocation.latitude, draggedLocation.longitude);
                }
              });
            }

            setIsLoading(false);
          },
          (error) => {
            // Denied, unavailable or timed out: leave the map usable so the user can still
            // click a spot instead of sitting behind the loading state.
            console.error('Error getting location:', error);
            if (isMounted.current) setIsLoading(false);
          },
          // Without a timeout the browser can leave both callbacks unfired indefinitely
          // (blocked permission prompt, no location provider), pinning the picker on 'Loading...'.
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
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
  }, [reverseGeocode]);

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

    // Add geolocate control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: false,
      showUserHeading: true,
    });
    map.current.addControl(geolocateControl);

    // Create initial marker if we have a location
    if (currentLocation) {
      marker.current = new mapboxgl.Marker({ color: '#FF0000', draggable: true }).setLngLat([currentLocation.longitude, currentLocation.latitude]).addTo(map.current);

      // Handle marker drag
      marker.current.on('dragend', () => {
        const lngLat = marker.current?.getLngLat();
        if (lngLat) {
          const newLocation = {
            latitude: lngLat.lat,
            longitude: lngLat.lng,
          };
          setCurrentLocation(newLocation);
          reverseGeocode(newLocation.latitude, newLocation.longitude);
        }
      });

      reverseGeocode(currentLocation.latitude, currentLocation.longitude);
    }

    // Handle map click
    map.current.on('click', (e) => {
      const newLocation = {
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      };
      setCurrentLocation(newLocation);
      reverseGeocode(newLocation.latitude, newLocation.longitude);

      // Update or create marker
      if (marker.current) {
        marker.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      } else if (map.current) {
        marker.current = new mapboxgl.Marker({ color: '#FF0000', draggable: true }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(map.current);

        marker.current.on('dragend', () => {
          const lngLat = marker.current?.getLngLat();
          if (lngLat) {
            const draggedLocation = {
              latitude: lngLat.lat,
              longitude: lngLat.lng,
            };
            setCurrentLocation(draggedLocation);
            reverseGeocode(draggedLocation.latitude, draggedLocation.longitude);
          }
        });
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
      onLocationSelected({
        ...currentLocation,
        address,
      });
      onClose();
    }
  };

  return (
    <View style={styles.container}>
      {/* Map - Always rendered to keep Mapbox instance mounted */}
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />

      {/* Locating badge - must not cover the map or the close button, the map is already usable */}
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        </View>
      ) : null}

      {/* Close button */}
      <Pressable style={styles.closeButton} onPress={onClose}>
        <XIcon size={24} color="#000000" />
      </Pressable>

      {/* Location info and confirm button */}
      <View style={styles.bottomPanel}>
        {isReverseGeocoding ? (
          <Text style={styles.addressText}>{t('common.loading_address')}</Text>
        ) : address ? (
          <Text style={styles.addressText}>{address}</Text>
        ) : (
          <Text style={styles.noAddressText}>{t('common.no_address_found')}</Text>
        )}

        {currentLocation ? (
          <Text style={styles.coordinatesText}>
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        ) : null}

        <Button onPress={handleConfirmLocation} disabled={!currentLocation} style={styles.confirmButton}>
          <ButtonText>{t('common.set_location')}</ButtonText>
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9,
  },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loadingText: {
    color: '#6b7280',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
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
    backgroundColor: 'white',
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  noAddressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  confirmButton: {
    width: '100%',
  },
});

export default FullScreenLocationPicker;
