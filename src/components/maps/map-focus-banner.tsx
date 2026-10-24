import { LocateFixed } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { type MapFocus, type MapFocusPoints } from '@/lib/unit-map-focus';

interface MapFocusBannerProps {
  focus: MapFocus;
  located: MapFocusPoints;
  /** Frames the unit and its crew again after the dispatcher moved the map. */
  onRecenter: () => void;
}

/** The selected unit the map is framed on, and how much of it has a position (the unit, and how many of its crew). */
export function MapFocusBanner({ focus, located, onRecenter }: MapFocusBannerProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const hasPositions = located.points.length > 0;

  const details = hasPositions
    ? [
        located.unitLocated ? null : t('dispatch.unit_map_focus_no_unit_position'),
        located.crewTotal === 0 ? t('dispatch.unit_map_focus_no_crew') : t('dispatch.unit_map_focus_crew_located', { located: located.crewLocated, total: located.crewTotal }),
      ].filter((detail): detail is string => !!detail)
    : [t('dispatch.unit_map_focus_no_positions')];

  return (
    <View style={StyleSheet.flatten([styles.banner, isDark ? styles.bannerDark : styles.bannerLight])} testID="map-focus-banner" pointerEvents="box-none">
      <View style={styles.text}>
        <Text style={StyleSheet.flatten([styles.title, isDark ? styles.titleDark : styles.titleLight])} numberOfLines={1}>
          {focus.label}
        </Text>
        <Text style={StyleSheet.flatten([styles.detail, isDark ? styles.detailDark : styles.detailLight])} numberOfLines={2} testID="map-focus-banner-detail">
          {details.join(' · ')}
        </Text>
      </View>
      {hasPositions ? (
        <Pressable onPress={onRecenter} style={styles.recenter} accessibilityRole="button" accessibilityLabel={t('dispatch.unit_map_focus_recenter')} testID="map-focus-recenter">
          <Icon as={LocateFixed} size="sm" className="text-indigo-500" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 10,
  },
  bannerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: '#e5e7eb',
  },
  bannerDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    borderColor: '#374151',
  },
  text: {
    flexShrink: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#f9fafb',
  },
  detail: {
    fontSize: 11,
  },
  detailLight: {
    color: '#4b5563',
  },
  detailDark: {
    color: '#d1d5db',
  },
  recenter: {
    marginLeft: 6,
    padding: 6,
  },
});
