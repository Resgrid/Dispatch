import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Circle, Clock, Mail, MapPin, Phone, Shield, User, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getPersonnelInfo } from '@/api/personnel/personnel';
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
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

// The detail page only displays custom fields; nothing is edited here.
const ignoreUdfValues = () => {};

export default function PersonnelDetail() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { trackEvent } = useAnalytics();

  const [person, setPerson] = useState<PersonnelInfoResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!userId) return;
      try {
        setIsLoading(true);
        setError(null);
        const response = await getPersonnelInfo(userId);
        setPerson(response.Data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load personnel details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [userId]);

  useEffect(() => {
    if (person) {
      trackEvent('personnel_detail_viewed', {
        userId: person.UserId,
        name: `${person.FirstName} ${person.LastName}`,
      });
    }
  }, [person, trackEvent]);

  const handleBack = () => {
    router.back();
  };

  const handleCall = () => {
    if (person?.MobilePhone) {
      Linking.openURL(`tel:${person.MobilePhone}`);
    }
  };

  const handleEmail = () => {
    if (person?.EmailAddress) {
      Linking.openURL(`mailto:${person.EmailAddress}`);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return timestamp;
    }
  };

  const screenTitle = person ? `${person.FirstName} ${person.LastName}` : t('personnel.details');

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('personnel.details'),
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
            title: t('personnel.details'),
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

  if (!person) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('personnel.details'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-white p-5 dark:bg-gray-800">
            <Text className="text-center">{t('personnel.empty')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </View>
      </>
    );
  }

  const statusColor = person.StatusColor || '#6b7280';
  const staffingColor = person.StaffingColor || '#6b7280';

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
            {/* Header card with avatar and name */}
            <Box className="mx-4 mt-4 items-center rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <View style={[styles.avatarLarge, { borderColor: statusColor }]}>
                <Icon as={User} size="xl" color={statusColor} />
              </View>
              <Heading size="lg" className="mt-3 text-gray-900 dark:text-gray-50">
                {person.FirstName} {person.LastName}
              </Heading>
              {person.GroupName ? (
                <HStack className="mt-1 items-center" space="xs">
                  <Icon as={Users} size="xs" className="text-gray-400" />
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{person.GroupName}</Text>
                </HStack>
              ) : null}
              {person.IdentificationNumber ? (
                <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {t('personnel.id_number')}: {person.IdentificationNumber}
                </Text>
              ) : null}

              {/* Quick action buttons */}
              <HStack className="mt-4" space="md">
                {person.MobilePhone ? (
                  <Button size="sm" variant="outline" onPress={handleCall} className="rounded-full">
                    <Icon as={Phone} size="sm" className="mr-1 text-typography-700" />
                    <ButtonText>{t('personnel.call_phone')}</ButtonText>
                  </Button>
                ) : null}
                {person.EmailAddress ? (
                  <Button size="sm" variant="outline" onPress={handleEmail} className="rounded-full">
                    <Icon as={Mail} size="sm" className="mr-1 text-typography-700" />
                    <ButtonText>{t('personnel.send_email')}</ButtonText>
                  </Button>
                ) : null}
              </HStack>
            </Box>

            {/* Status & Staffing */}
            <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                {t('personnel.status_info')}
              </Heading>

              {/* Status row */}
              <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.status')}</Text>
                <HStack className="items-center rounded-full px-3 py-1" space="sm" style={{ backgroundColor: `${statusColor}18` }}>
                  <Circle size={10} fill={statusColor} color={statusColor} />
                  <Text style={{ color: statusColor }} className="text-sm font-semibold">
                    {person.Status || t('personnel.unknown_status')}
                  </Text>
                </HStack>
              </HStack>

              {/* Staffing row */}
              <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.staffing')}</Text>
                <HStack className="items-center rounded-full px-3 py-1" space="sm" style={{ backgroundColor: `${staffingColor}18` }}>
                  <Circle size={10} fill={staffingColor} color={staffingColor} />
                  <Text style={{ color: staffingColor }} className="text-sm font-semibold">
                    {person.Staffing || t('personnel.unknown_status')}
                  </Text>
                </HStack>
              </HStack>

              {/* Responding to */}
              {person.StatusDestinationName ? (
                <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.responding_to')}</Text>
                  <HStack className="items-center" space="xs">
                    <Icon as={person.StatusDestinationId?.startsWith('call-') ? MapPin : Building2} size="xs" className="text-amber-500" />
                    <Text className="text-sm font-medium text-amber-600 dark:text-amber-400">{person.StatusDestinationName}</Text>
                  </HStack>
                </HStack>
              ) : null}

              {/* Status timestamp */}
              {person.StatusTimestamp ? (
                <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.status_updated')}</Text>
                  <HStack className="items-center" space="xs">
                    <Icon as={Clock} size="xs" className="text-gray-400" />
                    <Text className="text-sm text-gray-600 dark:text-gray-300">{formatTimestamp(person.StatusTimestamp)}</Text>
                  </HStack>
                </HStack>
              ) : null}

              {/* Staffing timestamp */}
              {person.StaffingTimestamp ? (
                <HStack className="items-center justify-between py-3">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.staffing_updated')}</Text>
                  <HStack className="items-center" space="xs">
                    <Icon as={Clock} size="xs" className="text-gray-400" />
                    <Text className="text-sm text-gray-600 dark:text-gray-300">{formatTimestamp(person.StaffingTimestamp)}</Text>
                  </HStack>
                </HStack>
              ) : null}
            </Box>

            {/* Roles */}
            {person.Roles && person.Roles.length > 0 ? (
              <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  {t('personnel.roles')}
                </Heading>
                <HStack className="flex-wrap" space="sm">
                  {person.Roles.map((role) => (
                    <Box key={role} className="mb-2 rounded-full bg-indigo-50 px-3 py-1 dark:bg-indigo-900/30">
                      <HStack className="items-center" space="xs">
                        <Icon as={Shield} size="xs" className="text-indigo-500" />
                        <Text className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{role}</Text>
                      </HStack>
                    </Box>
                  ))}
                </HStack>
              </Box>
            ) : null}

            {/* Contact Information */}
            <Box className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                {t('personnel.contact_info')}
              </Heading>

              <VStack space="sm">
                <HStack className="items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
                  <HStack className="items-center" space="sm">
                    <Icon as={Mail} size="sm" className="text-gray-400" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.email')}</Text>
                  </HStack>
                  {person.EmailAddress ? (
                    <Pressable onPress={handleEmail}>
                      <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{person.EmailAddress}</Text>
                    </Pressable>
                  ) : (
                    <Text className="text-sm text-gray-400">{t('personnel.no_email')}</Text>
                  )}
                </HStack>

                <HStack className="items-center justify-between py-2">
                  <HStack className="items-center" space="sm">
                    <Icon as={Phone} size="sm" className="text-gray-400" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">{t('personnel.phone')}</Text>
                  </HStack>
                  {person.MobilePhone ? (
                    <Pressable onPress={handleCall}>
                      <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{person.MobilePhone}</Text>
                    </Pressable>
                  ) : (
                    <Text className="text-sm text-gray-400">{t('personnel.no_phone')}</Text>
                  )}
                </HStack>
              </VStack>
            </Box>

            {/* Custom fields (UDF) */}
            {person.UdfValues && person.UdfValues.length > 0 ? (
              <Box className="mx-4 mb-6 mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-50">
                  {t('personnel.custom_fields')}
                </Heading>
                {/* Labels and option values come from the definition; the raw rows only carry field ids and stored keys. */}
                <UdfFieldsRenderer entityType={1} entityId={person.UserId} onValuesChange={ignoreUdfValues} readOnly={true} isDark={colorScheme === 'dark'} />
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
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  bottomSpacer: {
    height: 32,
  },
});
