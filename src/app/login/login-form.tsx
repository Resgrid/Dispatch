import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, EyeIcon, EyeOffIcon, MonitorCog } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { View } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import type { SharedInstallationSetting } from '@/lib/mfa/shared-installation';

// Function to create schema - makes it easier to mock for testing
const createLoginFormSchema = () =>
  z.object({
    username: z
      .string({
        required_error: 'Username is required',
      })
      .min(3, 'Username must be at least 3 characters'),
    password: z
      .string({
        required_error: 'Password is required',
      })
      .min(6, 'Password must be at least 6 characters'),
  });

const loginFormSchema = createLoginFormSchema();

export type FormType = z.infer<typeof loginFormSchema>;

export type LoginFormProps = {
  onSubmit?: SubmitHandler<FormType>;
  isLoading?: boolean;
  error?: string;
  onServerUrlPress?: () => void;
  onSsoPress?: () => void;
  /** Opens the shared device setting for this installation (passkey plan section 10.5). */
  onSharedDevicePress?: () => void;
  /** This installation's shared device setting, when the screen shows it. */
  sharedDevice?: SharedInstallationSetting | null;
};

export const LoginForm = ({ onSubmit = () => {}, isLoading = false, error = undefined, onServerUrlPress, onSsoPress, onSharedDevicePress, sharedDevice = null }: LoginFormProps) => {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormType>({
    resolver: zodResolver(loginFormSchema),
  });
  const [validated] = useState({
    usernameValid: true,
    passwordValid: true,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleState = () => {
    setShowPassword((showState) => {
      return !showState;
    });
  };
  const handleKeyPress = () => {
    Keyboard.dismiss();
    handleSubmit(onSubmit)();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
      <View className="flex-1 justify-center bg-white p-4 dark:bg-gray-950">
        <View className="items-center justify-center">
          <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />
          <Text className="pb-2 text-center text-4xl font-bold">{t('login.page_title')}</Text>

          <Text className="mb-6 max-w-xl text-center text-gray-500 dark:text-gray-400">{t('login.page_subtitle')}</Text>
        </View>
        <FormControl isInvalid={!!errors?.username || !validated.usernameValid} className="w-full">
          <FormControlLabel>
            <FormControlLabelText>{t('login.username')}</FormControlLabelText>
          </FormControlLabel>
          <Controller
            defaultValue=""
            name="username"
            control={control}
            rules={{
              validate: async (value) => {
                try {
                  await loginFormSchema.parseAsync({ username: value });
                  return true;
                } catch (error: any) {
                  return error.message;
                }
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input>
                <InputField
                  placeholder={t('login.username_placeholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={handleKeyPress}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoComplete="off"
                />
              </Input>
            )}
          />
          <FormControlError>
            <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
            <FormControlErrorText className="text-red-500">{errors?.username?.message || (!validated.usernameValid && 'Username not found')}</FormControlErrorText>
          </FormControlError>
        </FormControl>
        {/* Label Message */}
        <FormControl isInvalid={!!errors.password || !validated.passwordValid} className="w-full">
          <FormControlLabel>
            <FormControlLabelText>{t('login.password')}</FormControlLabelText>
          </FormControlLabel>
          <Controller
            defaultValue=""
            name="password"
            control={control}
            rules={{
              validate: async (value) => {
                try {
                  await loginFormSchema.parseAsync({ password: value });
                  return true;
                } catch (error: any) {
                  return error.message;
                }
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input>
                <InputField
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.password_placeholder')}
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
            <FormControlErrorText className="text-red-500">{errors?.password?.message || (!validated.passwordValid && t('login.password_incorrect'))}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        {isLoading ? (
          <Button className="mt-8 w-full">
            <ButtonSpinner color={colors.light.neutral[400]} />
            <ButtonText className="ml-2 text-sm font-medium">{t('login.login_button_loading')}</ButtonText>
          </Button>
        ) : (
          <Button className="mt-8 w-full" variant="solid" action="primary" onPress={handleSubmit(onSubmit)}>
            <ButtonText>Log in</ButtonText>
          </Button>
        )}

        <View className="mt-14 flex-row">
          {onServerUrlPress ? (
            <Button className="flex-1" style={{ marginRight: onSsoPress ? 8 : 0 }} variant="outline" action="secondary" onPress={onServerUrlPress}>
              <ButtonText>{t('settings.server_url')}</ButtonText>
            </Button>
          ) : null}
          {onSsoPress ? (
            <Button className="flex-1" variant="outline" action="secondary" onPress={onSsoPress}>
              <ButtonText>{t('sso.sso_button')}</ButtonText>
            </Button>
          ) : null}
        </View>

        {/* Shared workstation: every sign-in here starts a shared session that locks between operators */}
        {onSharedDevicePress ? (
          <Button className="mt-2 self-center" variant="link" action="secondary" size="sm" onPress={onSharedDevicePress} testID="login-shared-device">
            <MonitorCog size={14} style={{ marginRight: 4 }} />
            <ButtonText className="text-xs">
              {!sharedDevice?.configured
                ? t('shared_session.device_setup')
                : sharedDevice.shared
                  ? sharedDevice.label
                    ? t('shared_session.device_on_label', { label: sharedDevice.label })
                    : t('shared_session.device_on')
                  : t('shared_session.device_settings')}
            </ButtonText>
          </Button>
        ) : null}

        {/* Footer */}
        <View className="mt-8 items-center">
          <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
            {t('login.no_account')} <Text className="text-primary-600 underline">{t('login.register')}</Text>
          </Text>
          <Text className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Resgrid, LLC. {t('login.footer_text')}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Default export for Expo Router
export default LoginForm;
