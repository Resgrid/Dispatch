import type Mapbox from '@rnmapbox/maps';
import { useColorScheme } from 'nativewind';
import React, { useCallback } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { MAP_ICONS } from '@/constants/map-icons';
import { isPoiMarker } from '@/lib/destination-helpers';
import { getMapMarkerColor, getPoiMarkerIconChar, getPoiMarkerShapePath, resolveMapMarkerIconKey } from '@/lib/map-markers';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  pin: MapMakerInfoData;
  size?: number;
  markerRef?: Mapbox.PointAnnotation | null;
  onPress?: (pin: MapMakerInfoData) => void;
}

/**
 * POI Marker dimensions per the reference document:
 * - Total size: 36 x 48 pixels
 * - viewBox for SVG shapes: "-24 -48 48 48"
 * - Icon positioned: centered-X (left:50%, translateX:-50%), top: 10px
 * - Icon font size: 14px, color: #ffffff
 */
const POI_MARKER_WIDTH = 36;
const POI_MARKER_HEIGHT = 48;
const POI_ICON_TOP_OFFSET = 10;
const POI_ICON_FONT_SIZE = 14;

const PinMarker = React.memo<PinMarkerProps>(({ pin, size = 32, onPress }) => {
  const { colorScheme } = useColorScheme();

  const handlePress = useCallback(() => {
    onPress?.(pin);
  }, [onPress, pin]);

  const isPoiMapPin = isPoiMarker({
    type: pin.Type,
    poiTypeId: pin.PoiTypeId,
    layerId: pin.LayerId,
    imagePath: pin.ImagePath,
    poiImage: pin.PoiImage,
  });

  // Non-POI (legacy) icon resolution
  const iconKey = resolveMapMarkerIconKey(pin) as MapIconKey;
  const icon = MAP_ICONS[iconKey] || MAP_ICONS.call;

  // POI marker properties
  const poiColor = getMapMarkerColor(pin);
  const poiShapePath = getPoiMarkerShapePath(pin.Marker);
  const poiIconChar = getPoiMarkerIconChar(pin.PoiImage);

  /**
   * Scale factor: the SVG viewBox is 48x48, rendered into POI_MARKER_WIDTH x POI_MARKER_HEIGHT.
   * scaleX = 36/48 = 0.75, scaleY = 48/48 = 1.0
   */
  const svgWidth = POI_MARKER_WIDTH;
  const svgHeight = POI_MARKER_HEIGHT;

  // Drop shadow style: offset(0,1px), blur=2px, rgba(17,24,39,0.35)
  const shadowStyle = {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  };

  // On native, the map-icons font Unicode characters (PUA range) won't render
  // without the font bundled. We show the character anyway — if the font is
  // bundled with the app under the "map-icons" family name, it will render.
  // Otherwise the system will show a fallback glyph or nothing.
  const poiIconTextStyle = {
    position: 'absolute' as const,
    top: POI_ICON_TOP_OFFSET,
    left: '50%' as const,
    transform: [{ translateX: -POI_ICON_FONT_SIZE / 2 }],
    fontSize: POI_ICON_FONT_SIZE,
    lineHeight: POI_ICON_FONT_SIZE,
    color: '#ffffff',
    fontFamily: Platform.OS === 'web' ? 'map-icons' : 'map-icons',
    includeFontPadding: false,
    textAlignVertical: 'center' as const,
  };

  if (isPoiMapPin) {
    return (
      <TouchableOpacity style={styles.poiContainer} onPress={handlePress} activeOpacity={0.7}>
        <View style={[styles.poiShapeWrapper, { width: svgWidth, height: svgHeight }, shadowStyle]}>
          {/* SVG background shape */}
          <Svg viewBox="-24 -48 48 48" width={svgWidth} height={svgHeight}>
            <Path d={poiShapePath} fill={poiColor} />
          </Svg>

          {/* White font icon overlay */}
          <Text style={poiIconTextStyle} numberOfLines={1} allowFontScaling={false}>
            {poiIconChar}
          </Text>
        </View>

        <Text style={StyleSheet.flatten([styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }])} numberOfLines={2}>
          {pin.Title}
        </Text>
      </TouchableOpacity>
    );
  }

  // Non-POI legacy marker rendering
  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <Image fadeDuration={0} source={icon.uri} style={StyleSheet.flatten([styles.image, { width: size, height: size }])} />
      <Text style={StyleSheet.flatten([styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }])} numberOfLines={2}>
        {pin.Title}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // POI shape wrapper — matches the reference document's 36x48px marker
  poiShapeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  image: {
    overflow: 'visible',
    resizeMode: 'cover',
  },
  title: {
    marginTop: 2,
    overflow: 'visible',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PinMarker;
