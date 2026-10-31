import { Server } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { useLoginServer } from '@/hooks/use-login-server';

interface LoginServerBadgeProps {
  /** Opens the server selector; without it the badge is a plain label. */
  onPress?: () => void;
}

/** Names the server the login form signs in to (US West, EU Central or Custom), so a wrong server is spotted before signing in. */
export const LoginServerBadge = ({ onPress }: LoginServerBadgeProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { name } = useLoginServer();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={t('login.server.signing_in_to', { server: name })}
      accessibilityHint={onPress ? t('login.server.change_hint') : undefined}
      testID="login-server-badge"
      className="flex-row items-center self-center rounded-full border border-gray-300 px-3 py-1.5 dark:border-gray-700"
    >
      <Server size={14} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">
        {t('login.server.label')} <Text className="text-sm font-semibold text-gray-900 dark:text-white">{name}</Text>
      </Text>
    </Pressable>
  );
};
