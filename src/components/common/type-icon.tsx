import { Image as ExpoImage } from 'expo-image';
import React, { useState } from 'react';
import { Image as RNImage, type ImageStyle, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { getTypeIconUrl, getTypeMapIcon } from '@/lib/type-icons';

export interface TypeIconProps {
  /** The department's uploaded icon for the type (absolute URL, anonymous GET); null when none was uploaded. */
  iconUrl?: string | null;
  /** The built-in map icon the type picked (a MAP_ICONS key such as "ambulance" or "fire"); null when none. */
  mapIcon?: string | null;
  /** Edge length of the square the icon is fitted into. */
  size?: number;
  /** Rendered when neither icon is available (or both failed to load). */
  fallback?: React.ReactNode;
  /** Applied to the rendered image (not the fallback), e.g. a backdrop behind a transparent icon. */
  style?: StyleProp<ImageStyle>;
  /** Applied to the box around the rendered image (not the fallback), e.g. spacing that the fallback carries itself. */
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The icon a department gave a unit, call or POI type or a personnel role, shown beside the item's name so an Ambulance reads differently
 * from a MUG, or a structure fire from a medical call, at a glance. Prefers the uploaded icon, then the built-in map
 * icon the type picked, then `fallback` (nothing by default). An image that fails to load falls through to the next
 * option. Decorative: the name and type are always shown as text next to it, so it is hidden from screen readers.
 */
export const TypeIcon: React.FC<TypeIconProps> = React.memo(({ iconUrl, mapIcon, size = 24, fallback = null, style, containerStyle, testID }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [failedMapIcon, setFailedMapIcon] = useState<string | null>(null);

  const url = getTypeIconUrl(iconUrl);
  const mapIconEntry = getTypeMapIcon(mapIcon);
  const box = { width: size, height: size };

  if (url && failedUrl !== url) {
    return (
      <View style={[styles.container, box, containerStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden testID={testID}>
        <ExpoImage
          source={{ uri: url }}
          style={StyleSheet.flatten([box, style])}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={url}
          accessible={false}
          onError={() => setFailedUrl(url)}
          testID={testID ? `${testID}-url` : undefined}
        />
      </View>
    );
  }

  if (mapIconEntry && failedMapIcon !== mapIconEntry.imgName) {
    return (
      <View style={[styles.container, box, containerStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden testID={testID}>
        <RNImage
          source={mapIconEntry.uri}
          style={StyleSheet.flatten([box, style])}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          onError={() => setFailedMapIcon(mapIconEntry.imgName)}
          testID={testID ? `${testID}-map` : undefined}
        />
      </View>
    );
  }

  return <>{fallback}</>;
});

TypeIcon.displayName = 'TypeIcon';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
