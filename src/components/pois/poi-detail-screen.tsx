import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Navigation, StickyNote } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import StaticMap from '@/components/maps/static-map';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { openMapsWithDirections } from '@/lib/navigation';
import { getPoiPrimaryDisplayText } from '@/lib/poi-display';
import { useLocationStore } from '@/stores/app/location-store';
import { usePoisStore } from '@/stores/pois/store';
import { useToastStore } from '@/stores/toast/store';

export const PoiDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  // Field selectors - whole-store and object location selectors re-render this screen
  // on every store/GPS update
  const selectedPoi = usePoisStore((s) => s.selectedPoi);
  const isLoadingDetail = usePoisStore((s) => s.isLoadingDetail);
  const detailError = usePoisStore((s) => s.detailError);
  const fetchPoi = usePoisStore((s) => s.fetchPoi);
  const resetSelectedPoi = usePoisStore((s) => s.resetSelectedPoi);

  const poiId = useMemo(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    const parsedId = Number(rawId);
    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  }, [id]);

  useEffect(() => {
    if (poiId !== null) {
      fetchPoi(poiId, true);
    }

    return () => {
      resetSelectedPoi();
    };
  }, [fetchPoi, poiId, resetSelectedPoi]);

  const handleRoute = async () => {
    if (!selectedPoi?.Latitude || !selectedPoi?.Longitude) {
      showToast('error', t('pois.no_location_for_routing'));
      return;
    }

    // Read the location imperatively - subscribing here would re-render on every GPS tick
    const { latitude, longitude } = useLocationStore.getState();

    const success = await openMapsWithDirections(selectedPoi.Latitude, selectedPoi.Longitude, getPoiPrimaryDisplayText(selectedPoi), latitude || undefined, longitude || undefined);

    if (!success) {
      showToast('error', t('pois.route_error'));
    }
  };

  if (poiId === null) {
    return (
      <>
        <Stack.Screen options={{ title: t('pois.detail_title') }} />
        <View style={styles.screen}>
          <FocusAwareStatusBar />
          <ZeroState heading={t('pois.invalid_poi')} description={t('pois.invalid_poi_description')} isError={true} />
        </View>
      </>
    );
  }

  if (isLoadingDetail && !selectedPoi) {
    return (
      <>
        <Stack.Screen options={{ title: t('pois.detail_title') }} />
        <View style={styles.screen}>
          <FocusAwareStatusBar />
          <Loading text={t('pois.loading_detail')} />
        </View>
      </>
    );
  }

  if (detailError || !selectedPoi) {
    return (
      <>
        <Stack.Screen options={{ title: t('pois.detail_title') }} />
        <View style={styles.screen}>
          <FocusAwareStatusBar />
          <ZeroState heading={t('pois.detail_not_found')} description={detailError || t('pois.detail_not_found_description')} isError={true}>
            <Button onPress={() => router.back()}>
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </ZeroState>
        </View>
      </>
    );
  }

  const title = getPoiPrimaryDisplayText(selectedPoi) || t('pois.unnamed');
  const hasCoordinates = Number.isFinite(selectedPoi.Latitude) && Number.isFinite(selectedPoi.Longitude) && !(selectedPoi.Latitude === 0 && selectedPoi.Longitude === 0);

  return (
    <>
      <Stack.Screen options={{ title: title, headerBackTitle: '' }} />
      <View style={styles.screen}>
        <FocusAwareStatusBar />
        <ScrollView contentContainerStyle={styles.content}>
          <Card className="mb-4 rounded-xl border border-outline-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <Box className="p-4">
              <View style={styles.headerRow}>
                <View style={styles.headerTextContainer}>
                  <Heading size="lg">{title}</Heading>
                  <Text style={styles.subtitleText}>{selectedPoi.PoiTypeName || t('pois.unknown_type')}</Text>
                </View>
                {selectedPoi.IsDestination ? (
                  <Badge action="success" variant="outline" size="sm">
                    <BadgeText>{t('pois.destination')}</BadgeText>
                  </Badge>
                ) : null}
              </View>

              {selectedPoi.Address ? (
                <View style={styles.infoRow}>
                  <MapPin size={16} color="#6b7280" />
                  <Text style={styles.infoText}>{selectedPoi.Address}</Text>
                </View>
              ) : null}
            </Box>
          </Card>

          <Card className="mb-4 rounded-xl border border-outline-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <Box className="p-4">
              <Text style={styles.sectionTitle}>{t('pois.map')}</Text>
              {hasCoordinates ? (
                <>
                  <StaticMap latitude={selectedPoi.Latitude} longitude={selectedPoi.Longitude} address={selectedPoi.Address || title} zoom={15} height={220} showUserLocation={true} />
                  <Button className="mt-4" onPress={handleRoute}>
                    <ButtonIcon as={Navigation} />
                    <ButtonText>{t('common.route')}</ButtonText>
                  </Button>
                </>
              ) : (
                <ZeroState heading={t('pois.no_location')} description={t('pois.no_location_description')} />
              )}
            </Box>
          </Card>

          <Card className="rounded-xl border border-outline-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <Box className="p-4">
              <Text style={styles.sectionTitle}>{t('pois.details')}</Text>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t('pois.type')}</Text>
                <Text style={styles.detailValue}>{selectedPoi.PoiTypeName || t('pois.unknown_type')}</Text>
              </View>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t('pois.address')}</Text>
                <Text style={styles.detailValue}>{selectedPoi.Address || t('common.not_available')}</Text>
              </View>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t('pois.note')}</Text>
                <View style={styles.noteRow}>
                  <StickyNote size={16} color="#6b7280" />
                  <Text style={styles.detailValue}>{selectedPoi.Note || t('common.not_available')}</Text>
                </View>
              </View>
            </Box>
          </Card>
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  subtitleText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  infoText: {
    color: '#374151',
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailBlock: {
    marginBottom: 16,
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
