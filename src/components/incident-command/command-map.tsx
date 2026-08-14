import Mapbox from '@rnmapbox/maps';
import { MapPinIcon, PlusIcon, XIcon } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Env } from '@/lib/env';
import { IncidentCapabilities, IncidentMapAnnotationType } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { type IncidentMapAnnotation } from '@/models/v4/incidentCommand/incidentMapAnnotation';
import { useLocationStore } from '@/stores/app/location-store';
import { useIncidentCommandStore } from '@/stores/incident-command/store';
import { useToastStore } from '@/stores/toast/store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGeoJson = any;

Mapbox.setAccessToken(Env.MAPBOX_PUBKEY);

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

interface ParsedAnnotation {
  annotation: IncidentMapAnnotation;
  point?: [number, number];
  shape?: { type: 'FeatureCollection'; features: AnyGeoJson[] };
}

/** Full-screen tactical map: renders IC map annotations and lets users add/remove marker annotations. */
export const CommandMap: React.FC = () => {
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.showToast);
  const board = useIncidentCommandStore((s) => s.board);
  const capabilities = useIncidentCommandStore((s) => s.capabilities);
  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [addMode, setAddMode] = useState(false);
  const [pending, setPending] = useState<{ longitude: number; latitude: number } | null>(null);
  const [label, setLabel] = useState('');

  const canManage = (capabilities & IncidentCapabilities.ManageAnnotations) === IncidentCapabilities.ManageAnnotations;
  const annotations = useMemo(() => (board?.Annotations ?? []).filter((a) => !a.DeletedOn), [board?.Annotations]);

  const parsed = useMemo<ParsedAnnotation[]>(() => {
    return annotations
      .map((annotation) => {
        try {
          const fc = toFeatureCollection(JSON.parse(annotation.GeoJson));
          const point = firstPoint(fc);
          const isShape = annotation.AnnotationType === IncidentMapAnnotationType.Line || annotation.AnnotationType === IncidentMapAnnotationType.Polygon;
          return { annotation, point, shape: isShape ? fc : undefined };
        } catch {
          return { annotation };
        }
      })
      .filter((p) => p.point || p.shape);
  }, [annotations]);

  // Center: command post → first annotation point → current position → a broad default.
  const center = useMemo<[number, number]>(() => {
    const command = board?.Command;
    const lng = parseFloat(command?.CommandPostLongitude ?? '');
    const lat = parseFloat(command?.CommandPostLatitude ?? '');
    if (!isNaN(lng) && !isNaN(lat) && (lng !== 0 || lat !== 0)) return [lng, lat];
    const fromAnnotation = parsed.find((p) => p.point)?.point;
    if (fromAnnotation) return fromAnnotation;
    if (userLongitude && userLatitude) return [userLongitude, userLatitude];
    return [0, 0];
  }, [board?.Command, parsed, userLongitude, userLatitude]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapPress = (event: any) => {
    if (!addMode) return;
    const coordinates = event?.geometry?.coordinates;
    if (!coordinates) return;
    setPending({ longitude: coordinates[0], latitude: coordinates[1] });
  };

  const cancelAdd = () => {
    setPending(null);
    setLabel('');
    setAddMode(false);
  };

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
      cancelAdd();
    } catch {
      showToast('error', t('incident_command.save_error'));
    }
  };

  const confirmDelete = (annotation: IncidentMapAnnotation) => {
    if (!canManage) return;
    const doDelete = async () => {
      try {
        await useIncidentCommandStore.getState().deleteAnnotation(annotation.IncidentMapAnnotationId);
        showToast('success', t('incident_command.saved'));
      } catch {
        showToast('error', t('incident_command.save_error'));
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(t('incident_command.delete_annotation_confirm'))) void doDelete();
      return;
    }
    Alert.alert('', t('incident_command.delete_annotation_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('incident_command.release'), style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <Box className="flex-1">
      <Mapbox.MapView style={styles.map} logoEnabled={false} attributionEnabled={false} compassEnabled zoomEnabled rotateEnabled onPress={handleMapPress}>
        <Mapbox.Camera ref={cameraRef} zoomLevel={14} centerCoordinate={center} animationMode="flyTo" animationDuration={800} />

        {parsed.map(({ annotation, shape }, index) =>
          shape ? (
            <Mapbox.ShapeSource key={`shape-${annotation.IncidentMapAnnotationId}`} id={`ic-shape-${index}`} shape={shape}>
              {annotation.AnnotationType === IncidentMapAnnotationType.Polygon ? (
                <Mapbox.FillLayer id={`ic-fill-${index}`} style={{ fillColor: '#ef4444', fillOpacity: 0.25, fillOutlineColor: '#ef4444' }} />
              ) : (
                <Mapbox.LineLayer id={`ic-line-${index}`} style={{ lineColor: '#ef4444', lineWidth: 3, lineOpacity: 0.9 }} />
              )}
            </Mapbox.ShapeSource>
          ) : null
        )}

        {parsed.map(({ annotation, point }) =>
          point ? (
            <Mapbox.PointAnnotation key={`pt-${annotation.IncidentMapAnnotationId}`} id={`ic-pt-${annotation.IncidentMapAnnotationId}`} coordinate={point} onSelected={() => confirmDelete(annotation)}>
              <VStack className="items-center">
                <Box className="rounded bg-red-600 px-1">
                  <Text className="text-[10px] font-semibold text-white" numberOfLines={1}>
                    {annotation.Label || t('incident_command.marker')}
                  </Text>
                </Box>
                <MapPinIcon size={26} color="#dc2626" />
              </VStack>
            </Mapbox.PointAnnotation>
          ) : null
        )}

        {pending ? (
          <Mapbox.PointAnnotation id="ic-pending" coordinate={[pending.longitude, pending.latitude]}>
            <MapPinIcon size={30} color="#2563eb" />
          </Mapbox.PointAnnotation>
        ) : null}
      </Mapbox.MapView>

      {/* Add-marker toggle */}
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

      {/* Label entry for a pending marker */}
      {pending ? (
        <Box className="absolute inset-x-4 bottom-6 rounded-lg bg-background-50 p-3">
          <Text className="mb-2 text-sm font-semibold">{t('incident_command.marker_label')}</Text>
          <Input>
            <InputField value={label} onChangeText={setLabel} placeholder={t('incident_command.marker_label')} autoFocus />
          </Input>
          <HStack className="mt-3 space-x-3">
            <Button variant="outline" className="mr-2 flex-1" onPress={cancelAdd}>
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

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
