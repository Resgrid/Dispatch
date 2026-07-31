import { type Href, useRouter } from 'expo-router';
import { AlertCircle, Clock, Mail } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView } from 'react-native';

import { View } from '@/components/ui';
import { FocusAwareStatusBar } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';

import packageJson from '../../package.json';

export default function Maintenance() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    // Check if maintenance mode is disabled, redirect to login
    if (!Env.MAINTENANCE_MODE) {
      logger.info({
        message: 'Maintenance mode disabled, redirecting to login',
      });
      router.replace('/login' as Href);
    }
  }, [router]);

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView className="flex-1 bg-white dark:bg-gray-950">
        <View className="flex-1 px-4 py-12">
          {/* Logo */}
          <View className="mb-8 items-center">
            <Image source={require('@assets/images/Resgrid_JustText.png')} style={{ width: 200, height: 80 }} resizeMode="contain" />
          </View>

          {/* Maintenance Image/Icon */}
          <View className="mb-8 items-center">
            <View className="size-48 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900">
              <AlertCircle size={96} className="text-primary-600" />
            </View>
          </View>

          {/* Main Message */}
          <View className="mb-12 items-center">
            <Text className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-white">{t('maintenance.title')}</Text>
            <Text className="text-center text-lg text-gray-600 dark:text-gray-400">{t('maintenance.message')}</Text>
          </View>

          {/* Info Cards */}
          <View className="mb-8 gap-4">
            {/* Why is the Site Down */}
            <View className="rounded-2xl bg-white p-6 shadow-xs dark:bg-gray-900">
              <View className="mb-4 size-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                <AlertCircle size={24} className="text-primary-600" />
              </View>
              <Text className="mb-2 text-lg font-semibold uppercase text-gray-900 dark:text-white">{t('maintenance.why_down_title')}</Text>
              <Text className="text-gray-600 dark:text-gray-400">{t('maintenance.why_down_message')}</Text>
            </View>

            {/* What is the Downtime */}
            <View className="rounded-2xl bg-white p-6 shadow-xs dark:bg-gray-900">
              <View className="mb-4 size-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                <Clock size={24} className="text-primary-600" />
              </View>
              <Text className="mb-2 text-lg font-semibold uppercase text-gray-900 dark:text-white">{t('maintenance.downtime_title')}</Text>
              <Text className="text-gray-600 dark:text-gray-400">{t('maintenance.downtime_message')}</Text>
            </View>

            {/* Need Support */}
            <View className="rounded-2xl bg-white p-6 shadow-xs dark:bg-gray-900">
              <View className="mb-4 size-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                <Mail size={24} className="text-primary-600" />
              </View>
              <Text className="mb-2 text-lg font-semibold uppercase text-gray-900 dark:text-white">{t('maintenance.support_title')}</Text>
              <Text className="text-gray-600 dark:text-gray-400">
                {t('maintenance.support_message')} <Text className="text-primary-600 underline">support@resgrid.com</Text>
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View className="items-center pt-4">
            <Text className="text-sm text-gray-500 dark:text-gray-500">© {new Date().getFullYear()} Resgrid, LLC. Created with ❤️ in Nevada</Text>
            <Text className="mt-2 text-sm text-gray-400 dark:text-gray-600">v{packageJson.version}</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
