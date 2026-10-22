import { type Href, router, usePathname } from 'expo-router';
import { ChevronRightIcon, HourglassIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';

export const AWAITING_RESOURCES_ROUTE = '/awaiting-resources';

/**
 * Persistent strip under the app bar while any call is awaiting resources (conditional run cards): a required resource
 * marked "keep outstanding" has not been sent yet. Stays up on every screen until the list is empty, because a waiting
 * call is a crew short on scene, and opens the Awaiting Resources screen. Hidden on that screen itself, and whenever the
 * department does not have Dispatch.RunCardConditions.
 */
export const AwaitingResourcesBanner: React.FC = () => {
  const { t } = useTranslation();
  const isEnabled = useIsRunCardConditionsEnabled();
  const count = useAwaitingResourcesStore((state) => state.calls.length);
  const pathname = usePathname();

  if (!isEnabled || count === 0 || pathname === AWAITING_RESOURCES_ROUTE) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push(AWAITING_RESOURCES_ROUTE as Href)}
      accessibilityRole="button"
      accessibilityLabel={t('awaiting_resources.banner', { count })}
      accessibilityHint={t('awaiting_resources.banner_open')}
      testID="awaiting-resources-banner"
    >
      <View className="border-b border-orange-300 bg-orange-100 px-3 py-1.5 dark:border-orange-800 dark:bg-orange-950">
        <HStack space="sm" className="items-center justify-between">
          <HStack space="sm" className="shrink items-center">
            <HourglassIcon size={14} color="#ea580c" />
            <Text size="sm" className="shrink font-semibold text-orange-800 dark:text-orange-200" numberOfLines={1}>
              {t('awaiting_resources.banner', { count })}
            </Text>
          </HStack>
          <HStack space="xs" className="items-center">
            <Text size="xs" className="font-medium text-orange-700 dark:text-orange-300">
              {t('awaiting_resources.banner_open')}
            </Text>
            <ChevronRightIcon size={14} color="#ea580c" />
          </HStack>
        </HStack>
      </View>
    </Pressable>
  );
};
