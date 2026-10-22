import { MapPin, MapPinned } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TypeIcon } from '@/components/common/type-icon';
import { Badge, BadgeText } from '@/components/ui/badge';
import { getPoiPrimaryDisplayText, getPoiSecondaryDisplayText } from '@/lib/poi-display';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';

interface PoiCardProps {
  poi: PoiResultData;
  onPress: (poi: PoiResultData) => void;
}

export const PoiCard: React.FC<PoiCardProps> = ({ poi, onPress }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const primaryText = getPoiPrimaryDisplayText(poi);
  const secondaryText = getPoiSecondaryDisplayText(poi);
  const accentStyle = StyleSheet.flatten([styles.accent, { backgroundColor: poi.Color || '#2563eb' }]);

  const cardStyle = StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight]);
  const titleColor = isDark ? '#f9fafb' : '#111827';
  const secondaryColor = isDark ? '#9ca3af' : '#6b7280';
  const detailColor = isDark ? '#d1d5db' : '#4b5563';
  const iconColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <Pressable style={cardStyle} onPress={() => onPress(poi)}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <TypeIcon iconUrl={poi.IconUrl} size={28} containerStyle={styles.typeIcon} fallback={<View style={accentStyle} />} />
          <View style={styles.titleTextContainer}>
            <Text style={[styles.titleText, { color: titleColor }]}>{primaryText || t('pois.unnamed')}</Text>
            <Text style={[styles.typeText, { color: secondaryColor }]}>{poi.PoiTypeName || t('pois.unknown_type')}</Text>
          </View>
        </View>
        {poi.IsDestination ? (
          <Badge action="success" variant="outline" size="sm">
            <BadgeText>{t('pois.destination')}</BadgeText>
          </Badge>
        ) : null}
      </View>

      {secondaryText ? (
        <View style={styles.detailRow}>
          <MapPin size={14} color={iconColor} />
          <Text style={[styles.detailText, { color: detailColor }]} numberOfLines={2}>
            {secondaryText}
          </Text>
        </View>
      ) : null}

      {poi.Note ? (
        <View style={styles.detailRow}>
          <MapPinned size={14} color={iconColor} />
          <Text style={[styles.noteText, { color: detailColor }]} numberOfLines={2}>
            {poi.Note}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardLight: {
    backgroundColor: '#ffffff',
  },
  cardDark: {
    backgroundColor: '#1f2937',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  accent: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 12,
    marginTop: 6,
  },
  // The POI type's uploaded icon, in place of the color dot
  typeIcon: {
    marginRight: 10,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 13,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
});
