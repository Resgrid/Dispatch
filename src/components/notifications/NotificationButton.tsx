import { useCounts } from '@novu/react-native';
import React from 'react';

import { ActivityIndicator, Pressable, View } from '@/components/ui';
import { BellIcon } from '@/components/ui/lucide-icons';
import { Text } from '@/components/ui/text';
interface NotificationButtonProps {
  onPress: () => void;
}

export const NotificationButton = ({ onPress }: NotificationButtonProps) => {
  const { counts, isLoading } = useCounts({
    filters: [
      {
        read: false,
      },
    ],
  });

  if (isLoading) return <ActivityIndicator />;

  return (
    <Pressable onPress={onPress} className="mr-2 p-2" testID="notification-button">
      <View className="relative">
        <BellIcon size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />

        {counts?.[0]?.count && counts?.[0]?.count > 0 ? (
          <View className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-red-500">
            <Text className="text-xs font-bold text-white">{counts?.[0]?.count > 99 ? '99+' : counts?.[0]?.count}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};
