import { Server } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useLoginServer } from '@/hooks/use-login-server';

interface LoginServerBadgeProps {
  /** Opens the server selector; without it the badge is a plain label. */
  onPress?: () => void;
}

const BADGE_CLASS = 'flex-row items-center self-center rounded-full border border-gray-300 px-3 py-1.5 dark:border-gray-700';

/** Names the server the login form signs in to (US West, EU Central or Custom), so a wrong server is spotted before signing in. */
export const LoginServerBadge = ({ onPress }: LoginServerBadgeProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { name } = useLoginServer();
  const label = t('login.server.signing_in_to', { server: name });

  const content = (
    <>
      <Server size={14} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
      <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">
        {t('login.server.label')} <Text className="text-sm font-semibold text-gray-900 dark:text-white">{name}</Text>
      </Text>
    </>
  );

  // Only a badge that does something is a button; a label stays a label for assistive technologies.
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} testID="login-server-badge" className={BADGE_CLASS}>
        {content}
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('login.server.change_hint')} testID="login-server-badge" className={BADGE_CLASS}>
      {content}
    </Pressable>
  );
};
