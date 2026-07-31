import { Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Cloud, Flame, Heart, Leaf } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { SEVERITY_COLORS, WeatherAlertCategory, WeatherAlertCertainty, WeatherAlertSeverity, WeatherAlertUrgency } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { useWeatherAlertsStore } from '@/stores/weatherAlerts/store';

const formatTimestamp = (value?: string | null): string => {
  if (!value) return '—';
  try {
    return formatDateForDisplay(parseDateISOString(value), 'MMM dd, yyyy hh:mm t');
  } catch {
    return value;
  }
};

const getCategoryIcon = (category: number) => {
  switch (category) {
    case WeatherAlertCategory.Fire:
      return Flame;
    case WeatherAlertCategory.Health:
      return Heart;
    case WeatherAlertCategory.Env:
      return Leaf;
    case WeatherAlertCategory.Met:
      return Cloud;
    default:
      return AlertTriangle;
  }
};

const getSeverityLabel = (severity: number, t: (key: string) => string): string => {
  const map: Record<number, string> = {
    [WeatherAlertSeverity.Extreme]: t('weatherAlerts.severity.extreme'),
    [WeatherAlertSeverity.Severe]: t('weatherAlerts.severity.severe'),
    [WeatherAlertSeverity.Moderate]: t('weatherAlerts.severity.moderate'),
    [WeatherAlertSeverity.Minor]: t('weatherAlerts.severity.minor'),
    [WeatherAlertSeverity.Unknown]: t('weatherAlerts.severity.unknown'),
  };
  return map[severity] ?? map[WeatherAlertSeverity.Unknown];
};

const getUrgencyLabel = (urgency: number, t: (key: string) => string): string => {
  const map: Record<number, string> = {
    [WeatherAlertUrgency.Immediate]: t('weatherAlerts.urgency.immediate'),
    [WeatherAlertUrgency.Expected]: t('weatherAlerts.urgency.expected'),
    [WeatherAlertUrgency.Future]: t('weatherAlerts.urgency.future'),
    [WeatherAlertUrgency.Past]: t('weatherAlerts.urgency.past'),
    [WeatherAlertUrgency.Unknown]: t('weatherAlerts.urgency.unknown'),
  };
  return map[urgency] ?? map[WeatherAlertUrgency.Unknown];
};

const getCertaintyLabel = (certainty: number, t: (key: string) => string): string => {
  const map: Record<number, string> = {
    [WeatherAlertCertainty.Observed]: t('weatherAlerts.certainty.observed'),
    [WeatherAlertCertainty.Likely]: t('weatherAlerts.certainty.likely'),
    [WeatherAlertCertainty.Possible]: t('weatherAlerts.certainty.possible'),
    [WeatherAlertCertainty.Unlikely]: t('weatherAlerts.certainty.unlikely'),
    [WeatherAlertCertainty.Unknown]: t('weatherAlerts.certainty.unknown'),
  };
  return map[certainty] ?? map[WeatherAlertCertainty.Unknown];
};

export default function WeatherAlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { selectedAlert, isLoadingDetail, fetchAlertDetail } = useWeatherAlertsStore();

  useEffect(() => {
    if (id) {
      fetchAlertDetail(id);
    }
  }, [id, fetchAlertDetail]);

  if (isLoadingDetail) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('weatherAlerts.title'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight, styles.centered])}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!selectedAlert) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('weatherAlerts.title'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight, styles.centered])}>
          <Text style={{ color: isDark ? '#fff' : '#000', marginBottom: 16 }}>{t('common.no_results_found')}</Text>
          <Pressable
            onPress={() => {
              if (id) fetchAlertDetail(id);
            }}
            style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3b82f6', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const alert = selectedAlert;
  const severityColor = SEVERITY_COLORS[alert.Severity] ?? SEVERITY_COLORS[WeatherAlertSeverity.Unknown];
  const CategoryIcon = getCategoryIcon(alert.AlertCategory);

  return (
    <>
      <Stack.Screen
        options={{
          title: alert.Event || t('weatherAlerts.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={StyleSheet.flatten([styles.header, { backgroundColor: severityColor }])}>
            <HStack className="items-center" space="sm">
              <CategoryIcon size={20} color="#FFFFFF" />
              <VStack>
                <Text className="text-lg font-bold text-white">{alert.Event}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wider text-white/85">{getSeverityLabel(alert.Severity, t)}</Text>
              </VStack>
            </HStack>
          </View>

          {/* Headline */}
          {alert.Headline ? (
            <View style={StyleSheet.flatten([styles.section, isDark ? styles.sectionDark : styles.sectionLight])}>
              <Text className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{t('weatherAlerts.detail.headline')}</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.Headline}</Text>
            </View>
          ) : null}

          {/* Timing */}
          <View style={StyleSheet.flatten([styles.section, isDark ? styles.sectionDark : styles.sectionLight])}>
            <VStack space="xs">
              <DetailRow label={t('weatherAlerts.detail.effective')} value={formatTimestamp(alert.EffectiveUtc)} isDark={isDark} />
              {alert.OnsetUtc ? <DetailRow label={t('weatherAlerts.detail.onset')} value={formatTimestamp(alert.OnsetUtc)} isDark={isDark} /> : null}
              {alert.ExpiresUtc ? <DetailRow label={t('weatherAlerts.detail.expires')} value={formatTimestamp(alert.ExpiresUtc)} isDark={isDark} /> : null}
              {alert.SentUtc ? <DetailRow label={t('weatherAlerts.detail.sent')} value={formatTimestamp(alert.SentUtc)} isDark={isDark} /> : null}
            </VStack>
          </View>

          {/* Area */}
          {alert.AreaDescription ? (
            <View style={StyleSheet.flatten([styles.section, isDark ? styles.sectionDark : styles.sectionLight])}>
              <Text className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{t('weatherAlerts.detail.area')}</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.AreaDescription}</Text>
            </View>
          ) : null}

          {/* Description */}
          {alert.Description ? (
            <View style={StyleSheet.flatten([styles.section, isDark ? styles.sectionDark : styles.sectionLight])}>
              <Text className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{t('weatherAlerts.detail.description')}</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.Description}</Text>
            </View>
          ) : null}

          {/* Instructions */}
          {alert.Instruction ? (
            <View style={StyleSheet.flatten([styles.instructionSection, isDark ? styles.instructionDark : styles.instructionLight])}>
              <Text className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{t('weatherAlerts.detail.instruction')}</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.Instruction}</Text>
            </View>
          ) : null}

          {/* Metadata */}
          <View style={StyleSheet.flatten([styles.section, isDark ? styles.sectionDark : styles.sectionLight])}>
            <VStack space="xs">
              <DetailRow label={t('weatherAlerts.detail.urgency')} value={getUrgencyLabel(alert.Urgency, t)} isDark={isDark} />
              <DetailRow label={t('weatherAlerts.detail.certainty')} value={getCertaintyLabel(alert.Certainty, t)} isDark={isDark} />
              {alert.Sender ? <DetailRow label={t('weatherAlerts.detail.sender')} value={alert.Sender} isDark={isDark} /> : null}
            </VStack>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const DetailRow: React.FC<{ label: string; value: string; isDark: boolean }> = ({ label, value, isDark }) => (
  <HStack className="justify-between items-center">
    <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</Text>
    <Text className="text-xs text-gray-700 dark:text-gray-300 flex-shrink" numberOfLines={1}>
      {value}
    </Text>
  </HStack>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerLight: { backgroundColor: '#f3f4f6' },
  containerDark: { backgroundColor: '#030712' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 32 },
  header: {
    padding: 16,
  },
  section: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
  },
  sectionLight: { backgroundColor: '#ffffff' },
  sectionDark: { backgroundColor: '#1f2937' },
  instructionSection: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
  },
  instructionLight: { backgroundColor: '#FFF8E1' },
  instructionDark: { backgroundColor: '#2d2200' },
});
