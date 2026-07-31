import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Server, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeInUp, FadeOut, FadeOutLeft } from 'react-native-reanimated';
import * as z from 'zod';

import { getSystemConfig } from '@/api/config';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { buildApiUrl, CUSTOM_SERVER_VALUE, toBaseUrl, URL_PATTERN } from '@/lib/server-url';
import { type ResgridSystemLocation } from '@/models/v4/configs/getSystemConfigResultData';
import { useServerUrlStore } from '@/stores/app/server-url-store';

// Form validation schema
const loginFormSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const serverUrlSchema = z.object({
  url: z.string().regex(URL_PATTERN, 'form.invalid_url'),
});

type LoginFormType = z.infer<typeof loginFormSchema>;
type ServerUrlFormType = z.infer<typeof serverUrlSchema>;

// Web-optimized input component
interface WebInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  type?: 'text' | 'password';
  icon: React.ReactNode;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

const WebInput: React.FC<WebInputProps> = ({
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  icon,
  showPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
  autoFocus = false,
  onKeyDown,
  disabled = false,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.inputContainer}>
      <View style={StyleSheet.flatten([styles.inputWrapper, isDark ? styles.inputWrapperDark : styles.inputWrapperLight, error ? styles.inputWrapperError : {}, disabled ? styles.inputWrapperDisabled : {}])}>
        <View style={styles.inputIcon}>{icon}</View>
        <input
          type={type === 'password' && !showPassword ? 'password' : 'text'}
          className="web-input-accessible"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: 16,
            color: isDark ? '#ffffff' : '#111827',
            padding: '14px 12px',
            width: '100%',
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown as any}
          disabled={disabled}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {showPasswordToggle ? (
          <Pressable style={styles.toggleButton} onPress={onTogglePassword}>
            {showPassword ? <Eye size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <EyeOff size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorContainer}>
          <AlertCircle size={14} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

// Rotating Feature Display component
interface RotatingFeatureProps {
  title: string;
  description: string;
  featureIndex: number;
}

const RotatingFeature: React.FC<RotatingFeatureProps> = ({ title, description, featureIndex }) => {
  return (
    <Animated.View key={featureIndex} entering={FadeInRight.duration(400)} exiting={FadeOutLeft.duration(400)} style={styles.rotatingFeatureContainer}>
      <Text style={styles.rotatingFeatureTitle}>{title}</Text>
      <Text style={styles.rotatingFeatureDescription}>{description}</Text>
    </Animated.View>
  );
};

export default function LoginWeb() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { width, height } = useWindowDimensions();
  const { trackEvent } = useAnalytics();
  const router = useRouter();
  const { login, status, error, isAuthenticated } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showServerUrlModal, setShowServerUrlModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isServerUrlLoading, setIsServerUrlLoading] = useState(false);
  const [serverLocations, setServerLocations] = useState<ResgridSystemLocation[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>(CUSTOM_SERVER_VALUE);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const featureRotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setUrl, getUrl } = useServerUrlStore();

  const isDark = colorScheme === 'dark';
  const isWideScreen = width >= 1024;
  const isMediumScreen = width >= 768;

  const {
    control: loginControl,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<LoginFormType>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: '', password: '' },
  });

  const {
    control: serverUrlControl,
    handleSubmit: handleServerUrlSubmit,
    formState: { errors: serverUrlErrors },
    setValue: setServerUrlValue,
  } = useForm<ServerUrlFormType>({
    resolver: zodResolver(serverUrlSchema),
    defaultValues: { url: '' },
  });

  // Track page view
  useEffect(() => {
    trackEvent('login_web_view_rendered', {
      hasError: !!error,
      status: status,
      screenWidth: width,
    });
  }, [trackEvent, error, status, width]);

  // Handle authentication state changes
  useEffect(() => {
    if (status === 'signedIn' && isAuthenticated) {
      logger.info({ message: 'Login successful, redirecting to home' });
      router.replace('/(app)' as any);
    }
  }, [status, isAuthenticated, router]);

  // Handle login errors
  useEffect(() => {
    if (status === 'error') {
      logger.error({ message: 'Login failed', context: { error } });
      setShowErrorModal(true);
    }
  }, [status, error]);

  // Load the persisted server URL and the list of hosted sites when the modal opens.
  useEffect(() => {
    if (!showServerUrlModal) {
      return;
    }

    let isCancelled = false;

    const loadServers = async () => {
      setIsLoadingServers(true);

      try {
        // The persisted value includes the /api/vX suffix; reduce it to a bare base so we
        // can match it against a hosted site or show it for editing in the custom field.
        const currentUrl = await getUrl();
        const currentBaseUrl = toBaseUrl(currentUrl);

        let fetchedLocations: ResgridSystemLocation[] = [];
        try {
          const result = await getSystemConfig();
          fetchedLocations = result?.Data?.Locations ?? [];
        } catch (err) {
          // Best-effort: on failure the user can still enter a custom URL manually.
          logger.error({ message: 'Failed to load Resgrid hosted sites', context: { error: err } });
        }

        if (isCancelled) {
          return;
        }

        setServerLocations(fetchedLocations);

        // Preselect the hosted site whose API URL matches the persisted URL; otherwise fall
        // back to the Custom option and show the persisted URL so the user can edit it.
        const matchedLocation = fetchedLocations.find((location) => toBaseUrl(location.ApiUrl) === currentBaseUrl);
        if (matchedLocation) {
          setSelectedServer(matchedLocation.Name);
          setServerUrlValue('url', toBaseUrl(matchedLocation.ApiUrl));
        } else {
          setSelectedServer(CUSTOM_SERVER_VALUE);
          setServerUrlValue('url', currentBaseUrl);
        }
      } catch (err) {
        logger.error({ message: 'Failed to initialize server selection', context: { error: err } });
      } finally {
        setIsLoadingServers(false);
      }
    };

    loadServers();

    return () => {
      isCancelled = true;
    };
  }, [showServerUrlModal, getUrl, setServerUrlValue]);

  const onLoginSubmit = useCallback(
    async (data: LoginFormType) => {
      logger.info({ message: 'Starting Login', context: { username: data.username } });
      try {
        await login({ username: data.username, password: data.password });
      } catch (err) {
        logger.error({ message: 'Login failed with exception', context: { error: err } });
      }
    },
    [login]
  );

  const handleServerSelectChange = useCallback(
    (nextServer: string) => {
      setSelectedServer(nextServer);
      if (nextServer === CUSTOM_SERVER_VALUE) {
        return;
      }
      const location = serverLocations.find((item) => item.Name === nextServer);
      if (location) {
        // Mirror the selected site's URL into the (read-only) field for visibility.
        setServerUrlValue('url', toBaseUrl(location.ApiUrl));
      }
    },
    [serverLocations, setServerUrlValue]
  );

  const onServerUrlSubmit = useCallback(
    async (data: ServerUrlFormType) => {
      try {
        setIsServerUrlLoading(true);
        const location = serverLocations.find((item) => item.Name === selectedServer);
        // Use the custom-entered URL, or the selected hosted site's URL, and always persist
        // the full API URL (with the /api/vX suffix) that the API client expects.
        const resolvedBaseUrl = selectedServer === CUSTOM_SERVER_VALUE ? data.url : (location?.ApiUrl ?? data.url);
        const apiUrl = buildApiUrl(resolvedBaseUrl);
        await setUrl(apiUrl);
        logger.info({ message: 'Server URL updated', context: { url: apiUrl, server: selectedServer } });
        setShowServerUrlModal(false);
      } catch (err) {
        logger.error({ message: 'Failed to update server URL', context: { error: err } });
      } finally {
        setIsServerUrlLoading(false);
      }
    },
    [setUrl, serverLocations, selectedServer]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLoginSubmit(onLoginSubmit)();
      }
    },
    [handleLoginSubmit, onLoginSubmit]
  );

  const isLoading = status === 'loading';

  // Features for the landing section (rotating display)
  const features = [
    {
      title: t('login.feature_dispatch_title', 'Real-time Dispatch'),
      description: t('login.feature_dispatch_desc', 'Instantly dispatch units and manage calls with live updates across all devices.'),
    },
    {
      title: t('login.feature_mapping_title', 'Advanced Mapping'),
      description: t('login.feature_mapping_desc', 'Track units in real-time with detailed maps, routing, and location management.'),
    },
    {
      title: t('login.feature_personnel_title', 'Personnel Management'),
      description: t('login.feature_personnel_desc', 'Manage your team with role-based access, status tracking, and communication tools.'),
    },
  ];

  // Feature rotation effect
  useEffect(() => {
    featureRotationRef.current = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => {
      if (featureRotationRef.current) {
        clearInterval(featureRotationRef.current);
      }
    };
  }, [features.length]);

  const currentFeature = features[currentFeatureIndex];

  return (
    <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight, { height }])}>
      {/* Main Layout */}
      <View style={isWideScreen ? styles.splitLayout : styles.singleLayout}>
        {/* Left Side - Branding & Features (only on wide screens) */}
        {isWideScreen ? (
          <Animated.View entering={FadeIn.duration(800)} style={StyleSheet.flatten([styles.brandingSection, isDark ? styles.brandingSectionDark : styles.brandingSectionLight])}>
            {/* Background Pattern */}
            <View style={styles.patternOverlay}>
              <View style={StyleSheet.flatten([styles.patternCircle, styles.patternCircle1])} />
              <View style={StyleSheet.flatten([styles.patternCircle, styles.patternCircle2])} />
              <View style={StyleSheet.flatten([styles.patternCircle, styles.patternCircle3])} />
            </View>

            {/* Content */}
            <View style={styles.brandingContent}>
              {/* Large Prominent Logo */}
              <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.brandingLogoSection}>
                <View style={styles.brandingLogoStack}>
                  <Text style={styles.brandingLogoText}>Resgrid</Text>
                  <Text style={styles.brandingLogoSubtext}>Dispatch</Text>
                </View>
              </Animated.View>

              {/* Tagline */}
              <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.taglineContainer}>
                <Text style={styles.brandingTagline}>{t('login.branding_title', 'Emergency Response Management')}</Text>
              </Animated.View>

              {/* Rotating Feature Display */}
              <View style={styles.rotatingFeatureWrapper}>
                <RotatingFeature key={currentFeatureIndex} title={currentFeature.title} description={currentFeature.description} featureIndex={currentFeatureIndex} />
                {/* Feature Indicators */}
                <View style={styles.featureIndicators}>
                  {features.map((_, index) => (
                    <Pressable key={index} onPress={() => setCurrentFeatureIndex(index)} style={StyleSheet.flatten([styles.featureIndicator, index === currentFeatureIndex ? styles.featureIndicatorActive : {}])} />
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* Right Side - Login Form */}
        <View style={StyleSheet.flatten([styles.loginSection, !isWideScreen ? styles.loginSectionFullWidth : {}])}>
          <Animated.View
            entering={FadeIn.delay(isWideScreen ? 300 : 0).duration(600)}
            style={StyleSheet.flatten([styles.loginCard, isDark ? styles.loginCardDark : styles.loginCardLight, isMediumScreen ? styles.loginCardWide : {}])}
          >
            {/* Logo (shown on smaller screens) */}
            {!isWideScreen ? (
              <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.mobileLogoContainer}>
                <View style={styles.mobileLogoSection}>
                  <Text style={StyleSheet.flatten([styles.mobileLogoText, isDark ? styles.mobileLogoTextDark : styles.mobileLogoTextLight])}>Resgrid</Text>
                  <Text style={StyleSheet.flatten([styles.mobileLogoSubtext, isDark ? styles.mobileLogoSubtextDark : styles.mobileLogoSubtextLight])}>Dispatch</Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Header */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.loginHeader}>
              <Text style={StyleSheet.flatten([styles.loginTitle, isDark ? styles.loginTitleDark : styles.loginTitleLight])}>{t('login.welcome_title', 'Welcome Back')}</Text>
              <Text style={StyleSheet.flatten([styles.loginSubtitle, isDark ? styles.loginSubtitleDark : styles.loginSubtitleLight])}>{t('login.page_subtitle')}</Text>
            </Animated.View>

            {/* Login Form */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.formContainer}>
              <Controller
                control={loginControl}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WebInput
                    placeholder={t('login.username_placeholder')}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={loginErrors.username?.message}
                    icon={<User size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}
                    autoFocus
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                )}
              />

              <Controller
                control={loginControl}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <WebInput
                    placeholder={t('login.password_placeholder')}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={loginErrors.password?.message}
                    type="password"
                    icon={<Lock size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}
                    showPasswordToggle
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                )}
              />

              {/* Login Button */}
              <Pressable
                style={({ pressed }) => StyleSheet.flatten([styles.loginButton, pressed && !isLoading ? styles.loginButtonPressed : {}, isLoading ? styles.loginButtonLoading : {}])}
                onPress={handleLoginSubmit(onLoginSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <Loader2 size={20} color="#ffffff" />
                    <Text style={styles.loginButtonText}>{t('login.login_button_loading')}</Text>
                  </View>
                ) : (
                  <Text style={styles.loginButtonText}>{t('login.login_button')}</Text>
                )}
              </Pressable>

              {/* Server URL and SSO Buttons */}
              <View style={styles.actionButtonRow}>
                <Pressable
                  style={({ pressed }) =>
                    StyleSheet.flatten([styles.serverUrlButton, styles.actionButtonFlex, isDark ? styles.serverUrlButtonDark : styles.serverUrlButtonLight, pressed ? styles.serverUrlButtonPressed : {}])
                  }
                  onPress={() => setShowServerUrlModal(true)}
                >
                  <Server size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text style={StyleSheet.flatten([styles.serverUrlButtonText, isDark ? styles.serverUrlButtonTextDark : styles.serverUrlButtonTextLight])}>{t('settings.server_url')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) =>
                    StyleSheet.flatten([styles.serverUrlButton, styles.actionButtonFlex, isDark ? styles.serverUrlButtonDark : styles.serverUrlButtonLight, pressed ? styles.serverUrlButtonPressed : {}])
                  }
                  onPress={() => router.push('/login/sso' as any)}
                >
                  <Text style={StyleSheet.flatten([styles.serverUrlButtonText, isDark ? styles.serverUrlButtonTextDark : styles.serverUrlButtonTextLight])}>{t('sso.sso_button')}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.footerContainer}>
              <Text style={StyleSheet.flatten([styles.footerText, isDark ? styles.footerTextDark : styles.footerTextLight])}>
                {t('login.no_account')}{' '}
                <Text style={styles.registerLink} onPress={() => {}}>
                  {t('login.register')}
                </Text>
              </Text>
              <Text style={StyleSheet.flatten([styles.copyrightText, isDark ? styles.copyrightTextDark : styles.copyrightTextLight])}>
                © {new Date().getFullYear()} Resgrid, LLC. {t('login.footer_text')}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {/* Error Modal */}
      {showErrorModal ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowErrorModal(false)} />
          <Animated.View entering={FadeInUp.duration(300)} style={StyleSheet.flatten([styles.modalContent, isDark ? styles.modalContentDark : styles.modalContentLight])}>
            <View style={styles.modalIconContainer}>
              <AlertCircle size={48} color="#ef4444" />
            </View>
            <Text style={StyleSheet.flatten([styles.modalTitle, isDark ? styles.modalTitleDark : styles.modalTitleLight])}>{t('login.errorModal.title')}</Text>
            <Text style={StyleSheet.flatten([styles.modalMessage, isDark ? styles.modalMessageDark : styles.modalMessageLight])}>{t('login.errorModal.message')}</Text>
            <Pressable style={styles.modalButton} onPress={() => setShowErrorModal(false)}>
              <Text style={styles.modalButtonText}>{t('login.errorModal.confirmButton')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Server URL Modal */}
      {showServerUrlModal ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowServerUrlModal(false)} />
          <Animated.View entering={FadeInUp.duration(300)} style={StyleSheet.flatten([styles.modalContent, styles.serverUrlModalContent, isDark ? styles.modalContentDark : styles.modalContentLight])}>
            <Text style={StyleSheet.flatten([styles.modalTitle, isDark ? styles.modalTitleDark : styles.modalTitleLight])}>{t('settings.server_url')}</Text>

            {/* Hosted site selector */}
            <View style={styles.serverUrlInputContainer}>
              {isLoadingServers ? (
                <Text style={StyleSheet.flatten([styles.serverUrlNote, isDark ? styles.serverUrlNoteDark : styles.serverUrlNoteLight])}>{t('settings.loading_servers')}</Text>
              ) : (
                <select
                  className="web-input-accessible"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: `1px solid ${isDark ? '#404040' : '#d1d5db'}`,
                    backgroundColor: isDark ? '#262626' : '#ffffff',
                    color: isDark ? '#ffffff' : '#111827',
                    outline: 'none',
                  }}
                  value={selectedServer}
                  onChange={(e) => handleServerSelectChange(e.target.value)}
                  aria-label={t('settings.select_server')}
                >
                  {serverLocations.map((location) => (
                    <option key={location.Name} value={location.Name}>
                      {location.DisplayName || location.Name}
                    </option>
                  ))}
                  <option value={CUSTOM_SERVER_VALUE}>{t('settings.custom')}</option>
                </select>
              )}
            </View>

            <Controller
              control={serverUrlControl}
              name="url"
              render={({ field: { onChange, value } }) => (
                <View style={styles.serverUrlInputContainer}>
                  <input
                    type="url"
                    className="web-input-accessible"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: 14,
                      borderRadius: 8,
                      border: `1px solid ${serverUrlErrors.url ? '#ef4444' : isDark ? '#404040' : '#d1d5db'}`,
                      backgroundColor: isDark ? '#262626' : '#ffffff',
                      color: isDark ? '#ffffff' : '#111827',
                      outline: 'none',
                      opacity: selectedServer === CUSTOM_SERVER_VALUE ? 1 : 0.6,
                    }}
                    placeholder={t('settings.enter_server_url')}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    readOnly={selectedServer !== CUSTOM_SERVER_VALUE}
                  />
                  {serverUrlErrors.url ? <Text style={styles.errorText}>{t(serverUrlErrors.url.message ?? 'form.invalid_url')}</Text> : null}
                </View>
              )}
            />

            <Text style={StyleSheet.flatten([styles.serverUrlNote, isDark ? styles.serverUrlNoteDark : styles.serverUrlNoteLight])}>{t('settings.server_url_note')}</Text>

            <View style={styles.modalButtonRow}>
              <Pressable style={StyleSheet.flatten([styles.modalCancelButton, isDark ? styles.modalCancelButtonDark : styles.modalCancelButtonLight])} onPress={() => setShowServerUrlModal(false)}>
                <Text style={StyleSheet.flatten([styles.modalCancelButtonText, isDark ? styles.modalCancelButtonTextDark : styles.modalCancelButtonTextLight])}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={StyleSheet.flatten([styles.modalButton, isServerUrlLoading ? styles.modalButtonLoading : {}])}
                onPress={handleServerUrlSubmit(onServerUrlSubmit)}
                disabled={isServerUrlLoading || isLoadingServers}
              >
                <Text style={styles.modalButtonText}>{isServerUrlLoading ? '...' : t('common.save')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },
  containerLight: {
    backgroundColor: '#fafafa',
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  singleLayout: {
    flex: 1,
  },

  // Branding Section (Left side on wide screens)
  brandingSection: {
    flex: 1,
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  brandingSectionDark: {
    backgroundColor: '#171717',
  },
  brandingSectionLight: {
    backgroundColor: '#1e40af',
    // background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%)',
  },
  patternOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  patternCircle1: {
    width: 400,
    height: 400,
    top: -100,
    left: -100,
  },
  patternCircle2: {
    width: 300,
    height: 300,
    bottom: 100,
    right: -50,
  },
  patternCircle3: {
    width: 200,
    height: 200,
    top: '50%',
    left: '30%',
  },
  brandingContent: {
    zIndex: 1,
    maxWidth: 520,
    alignItems: 'center',
    width: '100%',
  },
  brandingLogoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandingLogoStack: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandingLogoText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -2,
  },
  brandingLogoSubtext: {
    fontSize: 64,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: -1,
    marginLeft: 12,
  },
  taglineContainer: {
    marginBottom: 40,
  },
  brandingTagline: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  brandingTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    lineHeight: 30,
  },
  brandingSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 32,
    lineHeight: 24,
    maxWidth: 420,
  },

  // Rotating Feature Styles
  rotatingFeatureWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  rotatingFeatureContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    minHeight: 140,
  },
  rotatingFeatureIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  rotatingFeatureTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  rotatingFeatureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  featureIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  featureIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  featureIndicatorActive: {
    backgroundColor: '#ffffff',
    width: 24,
  },

  featuresGrid: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
  },
  featureTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  featureCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureCardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureIconContainerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureIconInner: {
    fontSize: 20,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureTitleDark: {
    color: '#ffffff',
  },
  featureTitleLight: {
    color: '#ffffff',
  },
  featureDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  featureDescriptionDark: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  featureDescriptionLight: {
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // Login Section (Right side on wide screens)
  loginSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loginSectionFullWidth: {
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  loginCardDark: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
  },
  loginCardLight: {
    backgroundColor: '#ffffff',
  },
  loginCardWide: {
    maxWidth: 440,
  },
  mobileLogoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mobileLogoSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mobileLogoText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  mobileLogoTextDark: {
    color: '#ffffff',
  },
  mobileLogoTextLight: {
    color: '#1e40af',
  },
  mobileLogoSubtext: {
    fontSize: 32,
    fontWeight: '300',
    marginLeft: 6,
    letterSpacing: -0.5,
  },
  mobileLogoSubtextDark: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  mobileLogoSubtextLight: {
    color: '#3b82f6',
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 6,
  },
  loginTitleDark: {
    color: '#ffffff',
  },
  loginTitleLight: {
    color: '#111827',
  },
  loginSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginSubtitleDark: {
    color: '#9ca3af',
  },
  loginSubtitleLight: {
    color: '#6b7280',
  },
  formContainer: {
    gap: 12,
  },

  // Input styles
  inputContainer: {
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputWrapperDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  inputWrapperLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  inputWrapperDisabled: {
    opacity: 0.6,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  toggleButton: {
    padding: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
  },

  // Login Button
  loginButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginButtonPressed: {
    backgroundColor: '#1d4ed8',
    transform: [{ scale: 0.98 }],
  },
  loginButtonLoading: {
    backgroundColor: '#3b82f6',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Server URL Button
  actionButtonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionButtonFlex: {
    flex: 1,
    marginTop: 0,
    marginLeft: 4,
    marginRight: 4,
  },
  serverUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  serverUrlButtonDark: {
    borderColor: '#404040',
    backgroundColor: 'transparent',
  },
  serverUrlButtonLight: {
    borderColor: '#e5e7eb',
    backgroundColor: 'transparent',
  },
  serverUrlButtonPressed: {
    opacity: 0.8,
  },
  serverUrlButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  serverUrlButtonTextDark: {
    color: '#9ca3af',
  },
  serverUrlButtonTextLight: {
    color: '#6b7280',
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 13,
  },
  footerTextDark: {
    color: '#9ca3af',
  },
  footerTextLight: {
    color: '#6b7280',
  },
  registerLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
  copyrightText: {
    fontSize: 11,
    marginTop: 2,
  },
  copyrightTextDark: {
    color: '#6b7280',
  },
  copyrightTextLight: {
    color: '#9ca3af',
  },

  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 16,
  },
  modalContentDark: {
    backgroundColor: '#171717',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
  },
  serverUrlModalContent: {
    alignItems: 'stretch',
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#ffffff',
  },
  modalTitleLight: {
    color: '#111827',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalMessageDark: {
    color: '#9ca3af',
  },
  modalMessageLight: {
    color: '#6b7280',
  },
  modalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  modalButtonLoading: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelButtonDark: {
    borderColor: '#404040',
  },
  modalCancelButtonLight: {
    borderColor: '#e5e7eb',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButtonTextDark: {
    color: '#d1d5db',
  },
  modalCancelButtonTextLight: {
    color: '#374151',
  },
  serverUrlInputContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  serverUrlNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  serverUrlNoteDark: {
    color: '#ef4444',
  },
  serverUrlNoteLight: {
    color: '#ef4444',
  },
});
