import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { readSharedInstallation, saveSharedInstallation } from '@/lib/mfa/shared-installation';
import useAuthStore from '@/stores/auth/store';

/**
 * The shared device setting for this installation (passkey plan section 10.5), like Core Web's shared workstation
 * page. A shared installation asks for a shared session at every sign-in: it locks when idle or put away, the next
 * operator unlocks with their own second factor or ends the shift, and nothing is remembered between operators. It only
 * ever tightens; the department can make sessions shared without it.
 */
export default function SharedDevice() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [initial] = useState(readSharedInstallation);
  // Shared is the suggested choice for a device nobody has set up yet (plan section 12.5.2); personal stays one tap away.
  const [shared, setShared] = useState(initial.configured ? initial.shared : true);
  const [label, setLabel] = useState(initial.label ?? '');

  const save = () => {
    saveSharedInstallation({ shared, label: shared ? label : null });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('shared_session.device_title') }} />
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack space="md">
          <Heading size="lg">{t('shared_session.device_title')}</Heading>
          <Text size="sm">{t('shared_session.device_body')}</Text>
          <HStack space="md" className="items-center justify-between">
            <Text className="flex-1">{t('shared_session.device_toggle')}</Text>
            <Switch value={shared} onValueChange={setShared} testID="shared-device-toggle" aria-label={t('shared_session.device_toggle')} />
          </HStack>
          {shared ? (
            <VStack space="xs">
              <Text size="sm">{t('shared_session.device_label')}</Text>
              <Input variant="outline" size="lg">
                <InputField
                  testID="shared-device-label"
                  value={label}
                  onChangeText={setLabel}
                  maxLength={64}
                  autoCapitalize="words"
                  placeholder={t('shared_session.device_label_placeholder')}
                  aria-label={t('shared_session.device_label')}
                />
              </Input>
              <Text size="xs" className="text-gray-500">
                {t('shared_session.device_label_hint')}
              </Text>
            </VStack>
          ) : null}
          {signedIn ? (
            <Text size="sm" className="text-gray-500" testID="shared-device-next-sign-in">
              {t('shared_session.device_next_sign_in')}
            </Text>
          ) : null}
          <Button action="primary" onPress={save} testID="shared-device-save">
            <ButtonText>{t('shared_session.save')}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </>
  );
}
