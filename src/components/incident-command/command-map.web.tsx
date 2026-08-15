import { PlusIcon, XIcon } from 'lucide-react-native';
import mapboxgl from 'mapbox-gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';
import { IncidentCapabilities, IncidentMapAnnotationType } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { useLocationStore } from '@/stores/app/location-store';
import { useIncidentCommandStore } from '@/stores/incident-command/store';
import { useToastStore } from '@/stores/toast/store';
import { getDepartmentMapCenter } from '@/lib/map-center';

const MAPBOX_GL_CSS_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css';

/** Close enough to work a scene, used whenever the camera opens on a known incident location. */
const INCIDENT_ZOOM = 13;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGeoJson = any;

const toFeatureCollection = (geoJson: AnyGeoJson): { type: 'FeatureCollection'; features: AnyGeoJson[] } => {
  if (geoJson?.type === 'FeatureCollection') return geoJson;
  if (geoJson?.type === 'Feature') return { type: 'FeatureCollection', features: [geoJson] };
  if (geoJson?.type && geoJson?.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: geoJson }] };
  return { type: 'FeatureCollection', features: [] };
};

const firstPoint = (fc: { features: AnyGeoJson[] }): [number, number] | undefined => {
  for (const feature of fc.features) {
    if (feature?.geometry?.type === 'Point') return feature.geometry.coordinates as [number, number];
  }
  return undefined;
};

/** Web tactical map (mapbox-gl): renders IC annotations and supports click-to-add markers. */
export const CommandMap: React.FC = () => {
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.showToast);
  const board = useIncidentCommandStore((s) => s.board);
  const capabilities = useIncidentCommandStore((s) => s.capabilities);
  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const layerIdsRef = useRef<string[]>([]);
  const sourceIdsRef = useRef<string[]>([]);
  const addModeRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [pending, setPending] = useState<{ longitude: number; latitude: number } | null>(null);
  const [label, setLabel] = useState('');

  const canManage = (capabilities & IncidentCapabilities.ManageAnnotations) === IncidentCapabilities.ManageAnnotations;
  const annotations = useMemo(() => (board?.Annotations ?? []).filter((a) => !a.DeletedOn), [board?.Annotations]);

  // A command post or a device fix is a specific spot, so it keeps the close incident zoom. Only the
  // department fallback is a whole service area, and it carries the zoom the department chose.
  const camera = useMemo<{ center: [number, number]; zoom: number }>(() => {
    const command = board?.Command;
    const lng = parseFloat(command?.CommandPostLongitude ?? '');
    const lat = parseFloat(command?.CommandPostLatitude ?? '');
    if (!isNaN(lng) && !isNaN(lat) && (lng !== 0 || lat !== 0)) return { center: [lng, lat], zoom: INCIDENT_ZOOM };
    if (userLongitude && userLatitude) return { center: [userLongitude, userLatitude], zoom: INCIDENT_ZOOM };

    // Read once: two calls are two store reads, and the second could see a different config.
    const departmentCenter = getDepartmentMapCenter();

    return { center: [departmentCenter.longitude, departmentCenter.latitude], zoom: departmentCenter.zoomLevel };
  }, [board?.Command, userLongitude, userLatitude]);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  // Inject Mapbox GL CSS once.
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('mapbox-gl-css')) {
      const link = document.createElement('link');
      link.id = 'mapbox-gl-css';
      link.href = MAPBOX_GL_CSS_URL;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize the map once.
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    mapboxgl.accessToken = Env.MAPBOX_PUBKEY;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: camera.center,
      zoom: camera.zoom,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.on('load', () => setIsReady(true));
    map.current.on('click', (event) => {
      if (!addModeRef.current) return;
      setPending({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    });
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render annotations whenever they change.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    layerIdsRef.current.forEach((id) => {
      if (instance.getLayer(id)) instance.removeLayer(id);
    });
    sourceIdsRef.current.forEach((id) => {
      if (instance.getSource(id)) instance.removeSource(id);
    });
    layerIdsRef.current = [];
    sourceIdsRef.current = [];

    annotations.forEach((annotation, index) => {
      let fc: { type: 'FeatureCollection'; features: AnyGeoJson[] };
      try {
        fc = toFeatureCollection(JSON.parse(annotation.GeoJson));
      } catch {
        return;
      }
      const isShape = annotation.AnnotationType === IncidentMapAnnotationType.Line || annotation.AnnotationType === IncidentMapAnnotationType.Polygon;
      if (isShape) {
        const sourceId = `ic-src-${index}`;
        const layerId = `ic-layer-${index}`;
        instance.addSource(sourceId, { type: 'geojson', data: fc as AnyGeoJson });
        instance.addLayer(
          annotation.AnnotationType === IncidentMapAnnotationType.Polygon
            ? { id: layerId, type: 'fill', source: sourceId, paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.25, 'fill-outline-color': '#ef4444' } }
            : { id: layerId, type: 'line', source: sourceId, paint: { 'line-color': '#ef4444', 'line-width': 3 } }
        );
        sourceIdsRef.current.push(sourceId);
        layerIdsRef.current.push(layerId);
        return;
      }
      const point = firstPoint(fc);
      if (!point) return;
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML = `<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:0 4px;border-radius:3px;white-space:nowrap;">${(annotation.Label || t('incident_command.marker')).replace(/</g, '&lt;')}</span><span style="color:#dc2626;font-size:22px;line-height:1;">📍</span>`;
      if (canManage) {
        el.onclick = () => {
          // eslint-disable-next-line no-alert
          if (typeof window !== 'undefined' && window.confirm(t('incident_command.delete_annotation_confirm'))) {
            useIncidentCommandStore
              .getState()
              .deleteAnnotation(annotation.IncidentMapAnnotationId)
              .then(() => showToast('success', t('incident_command.saved')))
              .catch(() => showToast('error', t('incident_command.save_error')));
          }
        };
      }
      const marker = new mapboxgl.Marker({ element: el }).setLngLat(point).addTo(instance);
      markersRef.current.push(marker);
    });
  }, [annotations, isReady, canManage, showToast, t]);

  const saveMarker = async () => {
    if (!pending) return;
    const feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [pending.longitude, pending.latitude] } };
    try {
      await useIncidentCommandStore.getState().saveAnnotation({
        AnnotationType: IncidentMapAnnotationType.Marker,
        GeoJson: JSON.stringify(feature),
        Label: label.trim() || t('incident_command.marker'),
        IcsSymbolCode: '',
      });
      showToast('success', t('incident_command.saved'));
      setPending(null);
      setLabel('');
      setAddMode(false);
    } catch {
      showToast('error', t('incident_command.save_error'));
    }
  };

  return (
    <Box className="flex-1">
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {canManage && !pending ? (
        <Box className="absolute right-4 top-4">
          <Button size="sm" variant={addMode ? 'solid' : 'outline'} onPress={() => setAddMode((v) => !v)}>
            <ButtonIcon as={addMode ? XIcon : PlusIcon} className="mr-1" />
            <ButtonText className="text-xs">{addMode ? t('common.cancel') : t('incident_command.add_marker')}</ButtonText>
          </Button>
        </Box>
      ) : null}

      {addMode && !pending ? (
        <Box className="absolute inset-x-4 top-16 rounded bg-black/70 p-2">
          <Text className="text-center text-xs text-white">{t('incident_command.tap_to_place')}</Text>
        </Box>
      ) : null}

      {pending ? (
        <Box className="absolute inset-x-4 bottom-6 rounded-lg bg-background-50 p-3">
          <Text className="mb-2 text-sm font-semibold">{t('incident_command.marker_label')}</Text>
          <Input>
            <InputField value={label} onChangeText={setLabel} placeholder={t('incident_command.marker_label')} />
          </Input>
          <HStack className="mt-3 space-x-3">
            <Button
              variant="outline"
              className="mr-2 flex-1"
              onPress={() => {
                setPending(null);
                setLabel('');
                setAddMode(false);
              }}
            >
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button className="ml-2 flex-1" onPress={saveMarker}>
              <ButtonText>{t('incident_command.save')}</ButtonText>
            </Button>
          </HStack>
        </Box>
      ) : null}
    </Box>
  );
};

export default CommandMap;
