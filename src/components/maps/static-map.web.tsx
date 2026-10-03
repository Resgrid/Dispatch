import mapboxgl from 'mapbox-gl';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { useDepartmentMapStyle } from '@/lib/map-style';
import { applyMapboxGlAccessToken } from '@/lib/mapbox-gl-token-web';

interface StaticMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
  height?: number;
  showUserLocation?: boolean;
}

const StaticMap: React.FC<StaticMapProps> = ({ latitude, longitude, address, zoom = 15, height = 200 }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Department base map (day/night by theme). Construction reads it through a ref so a style change
  // (config load or theme flip) restyles the live map instead of rebuilding it.
  const mapStyle = useDepartmentMapStyle();
  const mapStyleRef = useRef(mapStyle);
  useEffect(() => {
    mapStyleRef.current = mapStyle;
  }, [mapStyle]);
  // The style the current map instance was built with or last switched to.
  const appliedMapStyleRef = useRef<string | null>(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (!mapContainer.current) return;

    applyMapboxGlAccessToken();

    // Add CSS if not already added
    if (!document.getElementById('mapbox-gl-css')) {
      const link = document.createElement('link');
      link.id = 'mapbox-gl-css';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    const initialStyle = mapStyleRef.current;
    appliedMapStyleRef.current = initialStyle;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: [longitude, latitude],
      zoom: zoom,
      attributionControl: false,
    });

    new mapboxgl.Marker().setLngLat([longitude, latitude]).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude, zoom]);

  // Switch the base map when the department style changes; the DOM marker survives setStyle.
  useEffect(() => {
    if (!map.current || appliedMapStyleRef.current === mapStyle) return;

    map.current.setStyle(mapStyle);
    appliedMapStyleRef.current = mapStyle;
  }, [mapStyle]);

  return (
    <View style={{ height, width: '100%', overflow: 'hidden', borderRadius: 8 }}>
      <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
    </View>
  );
};

export default StaticMap;
