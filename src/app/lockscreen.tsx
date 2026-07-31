import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, useRouter } from 'expo-router';
import { AlertTriangle, EyeIcon, EyeOffIcon, LockKeyhole } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { View } from '@/components/ui';
import { FocusAwareStatusBar } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { verifyPassword } from '@/lib/auth/api';
import { logger } from '@/lib/logging';
import useLockscreenStore from '@/stores/lockscreen/store';

const lockscreenFormSchema = z.object({
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(1, 'Password is required'),
});

type FormType = z.infer<typeof lockscreenFormSchema>;

export default function Lockscreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { unlock } = useLockscreenStore();
  const { logout, status } = useAuth();
  const authStore = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormType>({
    resolver: zodResolver(lockscreenFormSchema),
  });

  const onSubmit: SubmitHandler<FormType> = async (data) => {
    setIsUnlocking(true);
    setError(undefined);

    try {
      logger.info({
        message: 'Attempting to unlock screen',
      });

      const verification = await verifyPassword(data.password);

      if (verification === null) {
        // No cached password hash (e.g. SSO/OIDC login) - a fresh login is required
        logger.warn({
          message: 'Unlock failed: no password verification hash stored',
        });
        setError(t('lockscreen.relogin_required'));
        return;
      }

      if (!verification) {
        setError(t('lockscreen.unlock_failed'));
        return;
      }

      unlock();
      router.replace('/(app)' as Href);
    } catch (err) {
      logger.error({
        message: 'Failed to unlock screen',
        context: { error: err },
      });
      setError(t('lockscreen.unlock_failed'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLogout = async () => {
    logger.info({
      message: 'User logging out from lockscreen',
    });
    unlock();
    await logout();
    router.replace('/login' as Href);
  };

  const handleState = () => {
    setShowPassword((showState) => !showState);
  };

  const handleKeyPress = () => {
    Keyboard.dismiss();
    handleSubmit(onSubmit)();
  };

  return (
    <>
      <FocusAwareStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
        <View className="flex-1 justify-center bg-white p-4 dark:bg-gray-950">
          <View className="items-center justify-center">
            <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />

            {/* Lock Icon */}
            <View className="my-8">
              <View className="items-center justify-center rounded-full bg-primary-100 p-6 dark:bg-primary-900">
                <LockKeyhole size={64} className="text-primary-600" />
              </View>
            </View>

            <Text className="pb-2 text-center text-4xl font-bold">{t('lockscreen.title')}</Text>
            <Text className="mb-6 max-w-xl text-center text-gray-500 dark:text-gray-400">{t('lockscreen.message')}</Text>

            {/* User Info Display */}
            {authStore.isAuthenticated && (
              <View className="mb-6 items-center">
                <View className="mb-2 size-20 items-center justify-center rounded-full bg-primary-600">
                  <Text className="text-2xl font-bold text-white">
                    {/* Show first letter of username or profile name */}
                    {authStore.status === 'signedIn' ? 'U' : '?'}
                  </Text>
                </View>
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t('lockscreen.welcome_back')}</Text>
              </View>
            )}
          </View>

          {/* Password Input */}
          <FormControl isInvalid={!!errors.password || !!error} className="w-full">
            <FormControlLabel>
              <FormControlLabelText>{t('lockscreen.password')}</FormControlLabelText>
            </FormControlLabel>
            <Controller
              defaultValue=""
              name="password"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input>
                  <InputField
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('lockscreen.password_placeholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onSubmitEditing={handleKeyPress}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                  <InputSlot onPress={handleState} className="pr-3">
                    <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
                  </InputSlot>
                </Input>
              )}
            />
            <FormControlError>
              <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
              <FormControlErrorText className="text-red-500">{errors?.password?.message || error}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          {/* Unlock Button */}
          {isUnlocking ? (
            <Button className="mt-8 w-full">
              <ButtonSpinner color={colors.light.neutral[400]} />
              <ButtonText className="ml-2 text-sm font-medium">{t('lockscreen.unlocking')}</ButtonText>
            </Button>
          ) : (
            <Button className="mt-8 w-full" variant="solid" action="primary" onPress={handleSubmit(onSubmit)}>
              <ButtonText>{t('lockscreen.unlock_button')}</ButtonText>
            </Button>
          )}

          {/* Logout Link */}
          <View className="mt-6 items-center">
            <Pressable onPress={handleLogout}>
              <Text className="text-primary-600 underline">{t('lockscreen.not_you')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
