import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BOUNDARY_COLOR, type DispatchMapOverlay, PERSON_MARKER_COLOR, UNIT_MARKER_COLOR } from '@/lib/dispatch-board';

/**
 * Key for the dispatch overlay on the location picker: units are the larger circles, personnel the smaller ones (each
 * filled with its status colour), boundaries are the groups' geofences. Plain RN styles so it renders the same over the
 * native and web maps.
 */
export const DispatchMapLegend: React.FC<{ overlay: DispatchMapOverlay }> = ({ overlay }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.legend} pointerEvents="none" testID="dispatch-map-legend">
      {overlay.unitCount > 0 ? (
        <View style={styles.item}>
          <View style={[styles.unitDot, { backgroundColor: UNIT_MARKER_COLOR }]} />
          <Text style={styles.label}>
            {t('calls.dispatch_board.map_units')} ({overlay.unitCount})
          </Text>
        </View>
      ) : null}
      {overlay.personCount > 0 ? (
        <View style={styles.item}>
          <View style={[styles.personDot, { backgroundColor: PERSON_MARKER_COLOR }]} />
          <Text style={styles.label}>
            {t('calls.dispatch_board.map_personnel')} ({overlay.personCount})
          </Text>
        </View>
      ) : null}
      {overlay.boundaries.features.length > 0 ? (
        <View style={styles.item}>
          <View style={[styles.boundary, { borderColor: BOUNDARY_COLOR }]} />
          <Text style={styles.label}>{t('calls.dispatch_board.map_boundaries')}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  legend: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  personDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  boundary: {
    width: 12,
    height: 9,
    borderWidth: 2,
    borderRadius: 2,
  },
  label: {
    color: '#f9fafb',
    fontSize: 11,
  },
});
