import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Circle, Clock, MapPin, Shield, Truck, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getUnitsInfos } from '@/api/units/units';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

// The detail page only displays custom fields; nothing is edited here.
const ignoreUdfValues = () => {};

export default function UnitDetail() {
  const { id } = useLocalSearchParams();
  const unitId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { trackEvent } = useAnalytics();

  const [unit, setUnit] = useState<UnitInfoResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!unitId) {
        setIsLoading(false);
        setError('Missing unit id');
        setUnit(null);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const response = await getUnitsInfos('');
        const found = response.Data?.find((u: UnitInfoResultData) => u.UnitId === unitId) || null;
        setUnit(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load unit details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [unitId]);

  useEffect(() => {
    if (unit) {
      trackEvent('unit_detail_viewed', {
        unitId: unit.UnitId,
        name: unit.Name,
      });
    }
  }, [unit, trackEvent]);

  const handleBack = () => {
    router.back();
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return timestamp;
    }
  };

  const screenTitle = unit ? unit.Name : t('units.details');

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('units.details'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Loading />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('units.details'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-white p-5 dark:bg-gray-800">
            <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />
          </Box>
        </View>
      </>
    );
  }

  if (!unit) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('units.details'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-white p-5 dark:bg-gray-800">
            <Text className="text-center">{t('units.empty')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </View>
      </>
    );
  }

  const statusColor = unit.CurrentStatusColor || '#6b7280';

  return (
    <>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar hidden={true} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Box className="w-full max-w-[600px] self-center">
            {/* Header card with icon and name */}
            <Box className="mx-4 mt-4 items-center rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <View style={[styles.iconLarge, { borderColor: statusColor, backgroundColor: `${statusColor}18` }]}>
                <Icon as={Truck} size="xl" color={statusColor} />
              </View>
              <Heading size="lg" className="mt-3 text-gray-900 dark:text-gray-50">
                {unit.Name}
              </Heading>
              {unit.Type ? <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{unit.Type}</Text> : null}
              {unit.GroupName ? (
                <HStack className="mt-1 items-center" space="xs">
                  <Icon as={Building2} size="xs" className="text-gray-400" />
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{unit.GroupName}</Text>
                </HStack>
              ) : null}
            </Box>

            {/* Status Information */}
            <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                {t('units.status_info')}
              </Heading>

              {/* Status row */}
              <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.status')}</Text>
                <HStack className="items-center rounded-full px-3 py-1" space="sm" style={{ backgroundColor: `${statusColor}18` }}>
                  <Circle size={10} fill={statusColor} color={statusColor} />
                  <Text style={{ color: statusColor }} className="text-sm font-semibold">
                    {unit.CurrentStatus || t('units.unknown_status')}
                  </Text>
                </HStack>
              </HStack>

              {/* Destination */}
              <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.destination')}</Text>
                {unit.CurrentDestinationName ? (
                  <HStack className="items-center" space="xs">
                    <Icon as={MapPin} size="xs" className="text-amber-500" />
                    <Text className="text-sm font-medium text-amber-600 dark:text-amber-400">{unit.CurrentDestinationName}</Text>
                  </HStack>
                ) : (
                  <Text className="text-sm text-gray-400">{t('units.no_destination')}</Text>
                )}
              </HStack>

              {/* Status timestamp */}
              {unit.CurrentStatusTimestampUtc ? (
                <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.status_updated')}</Text>
                  <HStack className="items-center" space="xs">
                    <Icon as={Clock} size="xs" className="text-gray-400" />
                    <Text className="text-sm text-gray-600 dark:text-gray-300">{formatTimestamp(unit.CurrentStatusTimestampUtc)}</Text>
                  </HStack>
                </HStack>
              ) : null}

              {/* GPS */}
              {unit.Latitude && unit.Longitude ? (
                <HStack className="items-center justify-between py-3">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">GPS</Text>
                  <HStack className="items-center" space="xs">
                    <Icon as={MapPin} size="xs" className="text-gray-400" />
                    <Text className="text-sm text-gray-600 dark:text-gray-300">
                      {Number(unit.Latitude).toFixed(4)}, {Number(unit.Longitude).toFixed(4)}
                    </Text>
                  </HStack>
                </HStack>
              ) : null}
            </Box>

            {/* Roles */}
            {unit.Roles && unit.Roles.length > 0 ? (
              <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  {t('units.roles')}
                </Heading>
                <VStack space="sm">
                  {unit.Roles.map((role) => (
                    <HStack key={role.RoleId || role.RoleName} className="items-center justify-between border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-700">
                      <HStack className="items-center" space="sm">
                        <Icon as={Shield} size="xs" className="text-indigo-500" />
                        <Text className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{role.RoleName}</Text>
                      </HStack>
                      {role.Name ? (
                        <HStack className="items-center" space="xs">
                          <Icon as={User} size="xs" className="text-gray-400" />
                          <Text className="text-sm text-gray-600 dark:text-gray-300">{role.Name}</Text>
                        </HStack>
                      ) : (
                        <Text className="text-sm text-gray-400">Unassigned</Text>
                      )}
                    </HStack>
                  ))}
                </VStack>
              </Box>
            ) : null}

            {/* Vehicle Information */}
            {unit.Vin || unit.PlateNumber || unit.FourWheelDrive || unit.SpecialPermit ? (
              <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  {t('units.vehicle_info')}
                </Heading>
                <VStack space="sm">
                  {unit.Vin ? (
                    <HStack className="items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.vin')}</Text>
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{unit.Vin}</Text>
                    </HStack>
                  ) : null}
                  {unit.PlateNumber ? (
                    <HStack className="items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.plate_number')}</Text>
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{unit.PlateNumber}</Text>
                    </HStack>
                  ) : null}
                  <HStack className="items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.four_wheel_drive')}</Text>
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{unit.FourWheelDrive ? t('units.yes') : t('units.no')}</Text>
                  </HStack>
                  <HStack className="items-center justify-between py-2">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{t('units.special_permit')}</Text>
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{unit.SpecialPermit ? t('units.yes') : t('units.no')}</Text>
                  </HStack>
                </VStack>
              </Box>
            ) : null}

            {/* Custom fields (UDF) */}
            {unit.UdfValues && unit.UdfValues.length > 0 ? (
              <Box className="mx-4 mb-6 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  {t('units.custom_fields')}
                </Heading>
                {/* Labels and option values come from the definition; the raw rows only carry field ids and stored keys. */}
                <UdfFieldsRenderer entityType={2} entityId={unit.UnitId} onValuesChange={ignoreUdfValues} readOnly={true} isDark={colorScheme === 'dark'} />
              </Box>
            ) : null}

            {/* Note */}
            {unit.Note ? (
              <Box className="mx-4 mb-6 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  Note
                </Heading>
                <Text className="text-sm text-gray-700 dark:text-gray-200">{unit.Note}</Text>
              </Box>
            ) : null}

            {/* Bottom spacing */}
            <View style={styles.bottomSpacer} />
          </Box>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  iconLarge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 32,
  },
});
