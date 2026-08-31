import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { LoginOtpModal } from '@/components/auth/login-otp-modal';
import { View } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { useOidcLogin } from '@/hooks/use-oidc-login';
import { useSamlLogin } from '@/hooks/use-saml-login';
import { retrySsoExchangeWithOtp } from '@/lib/auth/api';
import type { AuthResponse, SsoConfig } from '@/lib/auth/types';
import { logger } from '@/lib/logging';
import { fetchSsoConfigForUser } from '@/services/sso-discovery';
import useAuthStore from '@/stores/auth/store';

// ---------------------------------------------------------------------------
// OidcSignInSection — only mounted when a valid OIDC authority is available
// ---------------------------------------------------------------------------

interface OidcSignInSectionProps {
  authority: string;
  clientId: string;
  username: string;
  departmentId?: number;
  isAuthenticating: boolean;
  onAuthStart: () => void;
  onAuthEnd: () => void;
  onTokenReceived: (authResponse: AuthResponse) => void;
  onMfaRequired: () => void;
  onError: (msg: string) => void;
}

function OidcSignInSection({ authority, clientId, username, departmentId, isAuthenticating, onAuthStart, onAuthEnd, onTokenReceived, onMfaRequired, onError }: OidcSignInSectionProps) {
  const { t } = useTranslation();
  const { request, response, promptAsync, exchangeCodeForResgridToken } = useOidcLogin(authority, clientId, username, departmentId);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (response?.type === 'success') {
      (async () => {
        onAuthStart();
        try {
          const authResponse = await exchangeCodeForResgridToken();
          if (authResponse === 'mfa_required') {
            onMfaRequired();
          } else if (!authResponse) {
            onError(t('sso.error_token_exchange'));
          } else {
            onTokenReceived(authResponse);
          }
        } catch (err) {
          logger.error({ message: 'SSO OidcSignInSection: exchange failed', context: { err } });
          onError(t('sso.error_generic'));
        } finally {
          onAuthEnd();
        }
      })();
    } else if (response?.type === 'error') {
      onError(t('sso.error_oidc_cancelled'));
    }
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = async () => {
    onAuthStart();
    try {
      await promptAsync();
    } finally {
      onAuthEnd();
    }
  };

  if (isAuthenticating) {
    return (
      <Button className="mt-2 w-full">
        <ButtonSpinner color={colors.light.neutral[400]} />
        <ButtonText className="ml-2 text-sm font-medium">{t('sso.authenticating')}</ButtonText>
      </Button>
    );
  }

  return (
    <Button className="mt-2 w-full" variant="solid" action="primary" onPress={handlePress} isDisabled={!request}>
      <ShieldCheck size={18} color="#ffffff" />
      <ButtonText className="ml-2">{t('sso.sign_in_button')}</ButtonText>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// SamlSignInSection — only mounted when a valid SAML idpSsoUrl is available
// ---------------------------------------------------------------------------

interface SamlSignInSectionProps {
  idpSsoUrl: string;
  username: string;
  departmentId?: number;
  isAuthenticating: boolean;
  onAuthStart: () => void;
  onAuthEnd: () => void;
  onTokenReceived: (authResponse: AuthResponse) => void;
  onMfaRequired: () => void;
  onError: (msg: string) => void;
}

function SamlSignInSection({ idpSsoUrl, username, departmentId, isAuthenticating, onAuthStart, onAuthEnd, onTokenReceived, onMfaRequired, onError }: SamlSignInSectionProps) {
  const { t } = useTranslation();
  const { startSamlLogin, handleSamlDeepLink } = useSamlLogin(idpSsoUrl, username, departmentId);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const processDeepLink = async (url: string) => {
      if (url.includes('auth/callback') && url.includes('saml_response')) {
        onAuthStart();
        try {
          const authResponse = await handleSamlDeepLink(url);
          if (authResponse === 'mfa_required') {
            onMfaRequired();
          } else if (!authResponse) {
            onError(t('sso.error_token_exchange'));
          } else {
            onTokenReceived(authResponse);
          }
        } catch (err) {
          logger.error({ message: 'SSO SamlSignInSection: deep link failed', context: { err } });
          onError(t('sso.error_generic'));
        } finally {
          onAuthEnd();
        }
      }
    };

    // Handle cold-start: app opened directly via SAML redirect URL
    Linking.getInitialURL().then((url) => {
      if (url) processDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      processDeepLink(url);
    });

    return () => subscription.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = async () => {
    onAuthStart();
    try {
      await startSamlLogin();
    } finally {
      onAuthEnd();
    }
  };

  if (isAuthenticating) {
    return (
      <Button className="mt-2 w-full">
        <ButtonSpinner color={colors.light.neutral[400]} />
        <ButtonText className="ml-2 text-sm font-medium">{t('sso.authenticating')}</ButtonText>
      </Button>
    );
  }

  return (
    <Button className="mt-2 w-full" variant="solid" action="primary" onPress={handlePress}>
      <ShieldCheck size={18} color="#ffffff" />
      <ButtonText className="ml-2">{t('sso.sign_in_button')}</ButtonText>
    </Button>
  );
}

// ---------------------------------------------------------------------------

const ssoLookupSchema = z.object({
  username: z.string({ required_error: 'Username is required' }).min(3, 'Username must be at least 3 characters'),
  departmentId: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), 'Department ID must be a number'),
});

type SsoLookupFormType = z.infer<typeof ssoLookupSchema>;

export default function SsoLoginScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const [phase, setPhase] = useState<'lookup' | 'sso-options'>('lookup');
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [resolvedDepartmentId, setResolvedDepartmentId] = useState<number | undefined>();
  const [showOtpPrompt, setShowOtpPrompt] = useState(false);
  const [otpInvalid, setOtpInvalid] = useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);

  const loginWithSso = useAuthStore((s) => s.loginWithSso);
  const status = useAuthStore((s) => s.status);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SsoLookupFormType>({
    resolver: zodResolver(ssoLookupSchema),
  });

  // Navigate to app once signed in
  useEffect(() => {
    if (status === 'signedIn') {
      router.replace('/(app)' as any);
    }
  }, [status, router]);

  const handleTokenReceived = useCallback(
    async (authResponse: AuthResponse) => {
      try {
        await loginWithSso(authResponse);
      } catch (err) {
        logger.error({ message: 'SSO: loginWithSso failed', context: { err } });
        setAuthError(t('sso.error_generic'));
      }
    },
    [loginWithSso, t]
  );

  // 2FA challenge from the exchange: the retained IdP token is retried with the code.
  const handleMfaRequired = useCallback(() => {
    setOtpInvalid(false);
    setShowOtpPrompt(true);
  }, []);

  const handleOtpSubmit = useCallback(
    async (code: string) => {
      setIsOtpSubmitting(true);
      try {
        const result = await retrySsoExchangeWithOtp(code);
        if (result.successful && result.authResponse) {
          setShowOtpPrompt(false);
          setOtpInvalid(false);
          await handleTokenReceived(result.authResponse);
        } else if (result.mfaRequired) {
          setOtpInvalid(true);
        } else {
          setShowOtpPrompt(false);
          setAuthError(t('sso.error_generic'));
        }
      } finally {
        setIsOtpSubmitting(false);
      }
    },
    [handleTokenReceived, t]
  );

  const onLookup: SubmitHandler<SsoLookupFormType> = async (data) => {
    setLookupError(null);
    setIsLookingUp(true);

    const parsedDeptId = data.departmentId ? parseInt(data.departmentId, 10) : undefined;

    try {
      const config = await fetchSsoConfigForUser(data.username.trim(), parsedDeptId);

      if (!config) {
        setLookupError(t('sso.error_user_not_found'));
        return;
      }

      if (!config.ssoEnabled) {
        setLookupError(t('sso.error_sso_not_enabled'));
        return;
      }

      setResolvedUsername(data.username.trim());
      setResolvedDepartmentId(parsedDeptId);
      setSsoConfig(config);
      setPhase('sso-options');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('sso.error_lookup_failed');
      setLookupError(message);
    } finally {
      setIsLookingUp(false);
    }
  };

  if (phase === 'lookup') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 justify-center bg-white p-4 dark:bg-gray-950">
            <View className="items-center justify-center">
              <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />
              <View className="mb-2 mt-4 flex-row items-center">
                <ShieldCheck size={24} color={colorScheme === 'dark' ? '#60a5fa' : '#1e40af'} />
                <Text className="ml-2 text-2xl font-bold">{t('sso.page_title')}</Text>
              </View>
              <Text className="mb-6 max-w-xl text-center text-gray-500 dark:text-gray-400">{t('sso.page_subtitle')}</Text>
            </View>

            <FormControl isInvalid={!!errors.username} className="w-full">
              <FormControlLabel>
                <FormControlLabelText>{t('login.username')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                defaultValue=""
                name="username"
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input>
                    <InputField placeholder={t('login.username_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} returnKeyType="next" autoCapitalize="none" autoComplete="off" />
                  </Input>
                )}
              />
              <FormControlError>
                <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
                <FormControlErrorText className="text-red-500">{errors.username?.message}</FormControlErrorText>
              </FormControlError>
            </FormControl>

            <FormControl isInvalid={!!errors.departmentId} className="mt-4 w-full">
              <FormControlLabel>
                <FormControlLabelText>
                  {t('sso.department_id_label')}
                  <Text className="text-gray-400"> ({t('sso.optional')})</Text>
                </FormControlLabelText>
              </FormControlLabel>
              <Controller
                defaultValue=""
                name="departmentId"
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input>
                    <InputField
                      placeholder={t('sso.department_id_placeholder')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      returnKeyType="done"
                      keyboardType="number-pad"
                      onSubmitEditing={handleSubmit(onLookup)}
                    />
                  </Input>
                )}
              />
              <FormControlError>
                <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
                <FormControlErrorText className="text-red-500">{errors.departmentId?.message}</FormControlErrorText>
              </FormControlError>
            </FormControl>

            {lookupError ? (
              <View className="mt-3 flex-row items-center rounded-lg bg-red-50 p-3 dark:bg-red-950">
                <AlertTriangle size={16} color="#ef4444" />
                <Text className="ml-2 text-sm text-red-600 dark:text-red-400">{lookupError}</Text>
              </View>
            ) : null}

            {isLookingUp ? (
              <Button className="mt-8 w-full">
                <ButtonSpinner color={colors.light.neutral[400]} />
                <ButtonText className="ml-2 text-sm font-medium">{t('sso.looking_up')}</ButtonText>
              </Button>
            ) : (
              <Button className="mt-8 w-full" variant="solid" action="primary" onPress={handleSubmit(onLookup)}>
                <ButtonText>{t('sso.continue_button')}</ButtonText>
              </Button>
            )}

            <Button className="mt-4 w-full" variant="outline" action="secondary" onPress={() => router.back()}>
              <ChevronLeft size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
              <ButtonText className="ml-1">{t('sso.back_to_login')}</ButtonText>
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Phase: sso-options
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center bg-white p-4 dark:bg-gray-950">
          <View className="items-center justify-center">
            <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />
            <View className="mb-2 mt-4 flex-row items-center">
              <ShieldCheck size={24} color={colorScheme === 'dark' ? '#60a5fa' : '#1e40af'} />
              <Text className="ml-2 text-2xl font-bold">{t('sso.sign_in_title')}</Text>
            </View>
            <Text className="mb-2 max-w-xl text-center text-gray-500 dark:text-gray-400">{resolvedUsername}</Text>
            <Text className="mb-6 max-w-xl text-center text-sm text-gray-400 dark:text-gray-500">{ssoConfig?.providerType === 'oidc' ? t('sso.provider_oidc') : t('sso.provider_saml')}</Text>
          </View>

          {authError ? (
            <View className="mb-4 flex-row items-center rounded-lg bg-red-50 p-3 dark:bg-red-950">
              <AlertTriangle size={16} color="#ef4444" />
              <Text className="ml-2 text-sm text-red-600 dark:text-red-400">{authError}</Text>
            </View>
          ) : null}

          {ssoConfig?.providerType === 'oidc' && ssoConfig.authority && ssoConfig.clientId ? (
            <OidcSignInSection
              authority={ssoConfig.authority}
              clientId={ssoConfig.clientId}
              username={resolvedUsername}
              departmentId={resolvedDepartmentId}
              isAuthenticating={isAuthenticating}
              onAuthStart={() => {
                setIsAuthenticating(true);
                setAuthError(null);
              }}
              onAuthEnd={() => setIsAuthenticating(false)}
              onTokenReceived={handleTokenReceived}
              onMfaRequired={handleMfaRequired}
              onError={(msg) => {
                setAuthError(msg);
                setIsAuthenticating(false);
              }}
            />
          ) : null}

          {ssoConfig?.providerType === 'saml2' && ssoConfig.idpSsoUrl ? (
            <SamlSignInSection
              idpSsoUrl={ssoConfig.idpSsoUrl}
              username={resolvedUsername}
              departmentId={resolvedDepartmentId}
              isAuthenticating={isAuthenticating}
              onAuthStart={() => {
                setIsAuthenticating(true);
                setAuthError(null);
              }}
              onAuthEnd={() => setIsAuthenticating(false)}
              onTokenReceived={handleTokenReceived}
              onMfaRequired={handleMfaRequired}
              onError={(msg) => {
                setAuthError(msg);
                setIsAuthenticating(false);
              }}
            />
          ) : null}

          <Button
            className="mt-4 w-full"
            variant="outline"
            action="secondary"
            onPress={() => {
              setPhase('lookup');
              setSsoConfig(null);
              setAuthError(null);
            }}
          >
            <ChevronLeft size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
            <ButtonText className="ml-1">{t('sso.back_to_lookup')}</ButtonText>
          </Button>

          {/* Two-factor challenge: SSO exchange answered mfa_required / invalid_totp */}
          <LoginOtpModal isOpen={showOtpPrompt} isSubmitting={isOtpSubmitting} invalidCode={otpInvalid} onSubmit={handleOtpSubmit} onClose={() => setShowOtpPrompt(false)} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
