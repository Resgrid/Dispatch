/* eslint-disable react/no-unstable-nested-components */

import { NovuProvider } from '@novu/react-native';
import Mapbox from '@rnmapbox/maps';
import { isRunningInExpoGo } from 'expo';
import { Redirect, Slot, usePathname } from 'expo-router';
import { Menu } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, Text as RNText, TouchableOpacity, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardViewToggles } from '@/components/dispatch-console';
import { NotificationButton } from '@/components/notifications/NotificationButton';
import { NotificationInbox } from '@/components/notifications/NotificationInbox';
import SideMenu from '@/components/sidebar/side-menu';
import { View } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Drawer, DrawerBackdrop, DrawerBody, DrawerContent, DrawerFooter } from '@/components/ui/drawer/index';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useInactivityLock } from '@/hooks/use-inactivity-lock';
import { useSignalRLifecycle } from '@/hooks/use-signalr-lifecycle';
import { useAuthStore } from '@/lib/auth';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { useIsFirstTime } from '@/lib/storage';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { usePushNotifications } from '@/services/push-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { FeatureFlagKeys, featureFlagsStore } from '@/stores/feature-flags/store';
import useLockscreenStore from '@/stores/lockscreen/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';
import { useWeatherAlertsStore } from '@/stores/weatherAlerts/store';

export default function TabLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const isLocked = useLockscreenStore((state) => state.isLocked);
  const [isFirstTime, _setIsFirstTime] = useIsFirstTime();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [webColorScheme, setWebColorScheme] = React.useState<'light' | 'dark'>('light');
  const pathname = usePathname();
  const isDispatchScreen = pathname === '/home' || pathname === '/' || pathname === '/index';

  // Get store states first (hooks must be at top level)
  const config = useCoreStore((state) => state.config);
  const coreIsInitializing = useCoreStore((state) => state.isInitializing);
  const coreIsInitialized = useCoreStore((state) => state.isInitialized);
  const rights = securityStore((state) => state.rights);
  const userId = useAuthStore((state) => state.userId);

  // Initialize inactivity lock monitoring
  useInactivityLock(status === 'signedIn');

  // Memoize drawer navigation handler for better performance
  const handleNavigate = useCallback(() => {
    setIsOpen(false);
  }, []);
  const { isActive, appState } = useAppLifecycle();
  const insets = useSafeAreaInsets();

  // Web dark mode detection (safe - only runs on web)
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setWebColorScheme(mediaQuery.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setWebColorScheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Refs to track initialization state
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);
  const initTimedOut = useRef(false);
  const hasHiddenSplash = useRef(false);
  const lastSignedInStatus = useRef<string | null>(null);
  const parentRef = useRef(null);

  // Initialize push notifications
  //usePushNotifications();

  // Initialize Mapbox - only on native platforms
  // On web, Mapbox GL JS is loaded separately and doesn't use this initialization
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Mapbox.setAccessToken(Env.MAPBOX_PUBKEY);
      logger.info({
        message: 'Mapbox access token set',
        context: { platform: Platform.OS },
      });
    }
  }, []);

  const initializeApp = useCallback(async () => {
    if (isInitializing.current) {
      logger.info({
        message: 'App initialization already in progress, skipping',
      });
      return;
    }

    if (status !== 'signedIn') {
      logger.info({
        message: 'User not signed in, skipping initialization',
        context: { status },
      });
      return;
    }

    isInitializing.current = true;
    initTimedOut.current = false;
    logger.info({
      message: 'Starting app initialization',
      context: {
        hasInitialized: hasInitialized.current,
        platform: Platform.OS,
      },
    });

    try {
      // Set a timeout for initialization to prevent infinite hanging
      const initTimeout = new Promise((_, reject) =>
        setTimeout(() => {
          initTimedOut.current = true;
          reject(new Error('Initialization timeout after 30 seconds'));
        }, 30000)
      );

      const initPromise = (async () => {
        await useCoreStore.getState().init();

        logger.info({
          message: 'Core store initialized, initializing calls store',
          context: { platform: Platform.OS },
        });

        await useCallsStore.getState().init();

        logger.info({
          message: 'Calls store initialized, getting security rights',
          context: { platform: Platform.OS },
        });

        await securityStore.getState().getRights();

        logger.info({
          message: 'Security rights retrieved, fetching feature flags',
          context: { platform: Platform.OS },
        });

        await featureFlagsStore.getState().fetchFlags();

        logger.info({
          message: 'Feature flags fetched, connecting SignalR',
          context: { platform: Platform.OS },
        });

        // Connect to SignalR after core initialization is complete
        try {
          await useSignalRStore.getState().connectUpdateHub();
          logger.info({
            message: 'SignalR update hub connected successfully',
            context: { platform: Platform.OS },
          });
        } catch (error) {
          logger.error({
            message: 'Failed to connect SignalR update hub during initialization',
            context: { error, platform: Platform.OS },
          });
          // Don't fail initialization if SignalR connection fails
        }

        // Connect the realtime chat hub only when the Chat.System feature flag is on for
        // this department; when it is off every chat surface stays hidden.
        if (featureFlagsStore.getState().isEnabled(FeatureFlagKeys.ChatSystem)) {
          try {
            await useSignalRStore.getState().connectChatHub();
            logger.info({
              message: 'SignalR chat hub connected successfully',
              context: { platform: Platform.OS },
            });
          } catch (error) {
            logger.error({
              message: 'Failed to connect SignalR chat hub during initialization',
              context: { error, platform: Platform.OS },
            });
          }
        } else {
          logger.info({
            message: 'Chat disabled by feature flag; skipping chat hub connection',
            context: { platform: Platform.OS },
          });
        }

        // Initialize weather alerts
        try {
          await useWeatherAlertsStore.getState().fetchSettings();
          const weatherSettings = useWeatherAlertsStore.getState().settings;
          if (weatherSettings?.WeatherAlertsEnabled) {
            await useWeatherAlertsStore.getState().fetchActiveAlerts();
          }
          logger.info({
            message: 'Weather alerts initialized',
            context: { enabled: weatherSettings?.WeatherAlertsEnabled ?? false },
          });
        } catch (error) {
          logger.error({
            message: 'Failed to initialize weather alerts',
            context: { error, platform: Platform.OS },
          });
        }

        hasInitialized.current = true;

        logger.info({
          message: 'App initialization completed successfully',
          context: { platform: Platform.OS },
        });
      })();

      // Swallow post-timeout rejections so they don't surface as unhandled, and
      // keep isInitializing true until the init promise fully settles
      initPromise
        .catch((error) => {
          if (initTimedOut.current) {
            logger.error({
              message: 'App initialization failed after initialization timeout',
              context: { error, platform: Platform.OS },
            });
          }
        })
        .finally(() => {
          isInitializing.current = false;
        });

      await Promise.race([initPromise, initTimeout]);
    } catch (error) {
      logger.error({
        message: 'Failed to initialize app',
        context: { error, platform: Platform.OS },
      });
      // Reset initialization state on error so it can be retried
      hasInitialized.current = false;
      // If the init promise is still hanging, clear the guard so a retry is possible
      isInitializing.current = false;
    }
  }, [status]);

  const refreshDataFromBackground = useCallback(async () => {
    if (status !== 'signedIn' || !hasInitialized.current) return;

    // On web platform, skip config refresh as network requests are blocked
    // This prevents an infinite loop when AppState changes trigger refreshes
    if (Platform.OS === 'web') {
      logger.info({
        message: 'Skipping background data refresh on web platform (AppState handling not needed)',
      });
      return;
    }

    logger.info({
      message: 'App resumed from background, refreshing data',
    });

    try {
      // Refresh data
      await Promise.all([useCoreStore.getState().fetchConfig(), useCallsStore.getState().fetchCalls(), useRolesStore.getState().fetchRoles()]);
    } catch (error) {
      logger.error({
        message: 'Failed to refresh data on app resume',
        context: { error },
      });
    }
  }, [status]);

  // Handle SignalR lifecycle management
  useSignalRLifecycle({
    isSignedIn: status === 'signedIn',
    hasInitialized: hasInitialized.current,
  });

  // WEB PLATFORM WORKAROUND: Call initialization directly during render
  // useEffect doesn't reliably fire on web platform due to React Native Web issues
  if (Platform.OS === 'web') {
    // CRITICAL: Also check coreIsInitializing from the store to prevent re-initialization during state updates
    const shouldInitialize = status === 'signedIn' && !hasInitialized.current && !isInitializing.current && !coreIsInitializing;

    if (shouldInitialize) {
      logger.info({
        message: 'WEB: Triggering initialization during render phase',
        context: {
          status,
          hasInitialized: hasInitialized.current,
          isInitializing: isInitializing.current,
          coreIsInitializing,
        },
      });
      // Trigger initialization in next tick to avoid setState during render
      Promise.resolve().then(() => {
        initializeApp();
      });
    }
  }

  // Handle app initialization (for native platforms)
  useEffect(() => {
    // Skip on web - handled above in render phase
    if (Platform.OS === 'web') {
      logger.info({
        message: 'Skipping useEffect initialization on web (handled in render)',
      });
      return;
    }

    const shouldInitialize = status === 'signedIn' && !hasInitialized.current && !isInitializing.current;

    logger.info({
      message: 'App initialization effect triggered',
      context: {
        status,
        hasInitialized: hasInitialized.current,
        isInitializing: isInitializing.current,
        shouldInitialize,
        lastStatus: lastSignedInStatus.current,
      },
    });

    if (shouldInitialize) {
      logger.info({
        message: 'Triggering app initialization',
        context: {
          statusChanged: lastSignedInStatus.current !== status,
          lastStatus: lastSignedInStatus.current,
          currentStatus: status,
        },
      });
      initializeApp();
    }

    // Stop location tracking when user signs out
    if (status === 'signedOut' && lastSignedInStatus.current === 'signedIn') {
      logger.info({
        message: 'User signed out, stopping location tracking',
      });
    }

    // Update last known status
    lastSignedInStatus.current = status;
  }, [status, initializeApp]); // Added initializeApp to dependencies

  // Handle app resuming from background - separate from initialization
  useEffect(() => {
    // Only trigger on state change, not on initial render
    if (isActive && appState === 'active' && hasInitialized.current) {
      const timer = setTimeout(() => {
        refreshDataFromBackground();
      }, 500); // Small delay to prevent multiple rapid calls

      return () => clearTimeout(timer);
    }
  }, [isActive, appState, refreshDataFromBackground]);

  // Drawer is closed by default - user opens via hamburger menu

  // Check for maintenance mode
  if (Env.MAINTENANCE_MODE) {
    logger.info({
      message: 'Maintenance mode enabled, redirecting to maintenance page',
    });
    return <Redirect href={'/maintenance' as any} />;
  }

  // Check if screen is locked
  if (isLocked && status === 'signedIn') {
    logger.info({
      message: 'Screen is locked, redirecting to lockscreen',
    });
    return <Redirect href={'/lockscreen' as any} />;
  }

  // Only show onboarding on iOS and Android, skip on web platform
  if (isFirstTime && Platform.OS !== 'web') {
    logger.info({
      message: 'Is first time navigating to onboarding',
    });

    return <Redirect href={'/onboarding' as any} />;
  } else if (status === 'signedOut' || status === 'idle' || status === 'error') {
    logger.info({
      message: 'User is not signed in, redirecting to login',
      context: { status },
    });

    return <Redirect href={'/login' as any} />;
  }

  // Show loading screen while app is initializing
  if (!coreIsInitialized || coreIsInitializing || !config) {
    logger.info({
      message: 'App still initializing, showing loading screen',
      context: {
        coreIsInitializing,
        coreIsInitialized,
        hasConfig: !!config,
      },
    });

    return (
      <View style={styles.container}>
        <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
          <ActivityIndicator size="large" color="#0066cc" />
          <Text className="mt-4 text-lg text-gray-600 dark:text-gray-400">Loading...</Text>
        </View>
      </View>
    );
  }

  logger.info({
    message: 'Rendering app layout',
    context: {
      status,
      isLocked,
      isFirstTime,
      platform: Platform.OS,
      userId: userId || 'null',
      hasConfig: !!config,
    },
  });

  // Web theme with dark mode support (matching panel header and button colors)
  const webIsDark = webColorScheme === 'dark';
  const webTheme = {
    navBar: { backgroundColor: webIsDark ? '#1f2937' : '#f9fafb' }, // gray-800 / gray-50 (panel header colors)
    navBarText: { color: webIsDark ? '#f9fafb' : '#030712' }, // gray-50 / gray-950
    sidebar: {
      backgroundColor: webIsDark ? '#030712' : '#f3f4f6', // gray-950 / gray-100
      borderRightColor: webIsDark ? '#1f2937' : '#e5e7eb', // gray-800 / gray-200
    },
    sidebarFooter: {
      borderTopColor: webIsDark ? '#1f2937' : '#e5e7eb',
      backgroundColor: webIsDark ? '#111827' : '#ffffff', // gray-900 / white
    },
    closeButton: { backgroundColor: '#2563eb' }, // blue-600 (panel button color)
    closeButtonText: { color: '#ffffff' },
    mainContent: { backgroundColor: webIsDark ? '#030712' : '#f3f4f6' }, // gray-950 / gray-100
  };

  const content =
    Platform.OS === 'web' ? (
      <RNView style={styles.container}>
        {/* Top Navigation Bar */}
        <RNView style={[layoutStyles.navBar, { paddingTop: insets.top }, webTheme.navBar]}>
          <CreateDrawerMenuButton setIsOpen={setIsOpen} colorScheme={webColorScheme} />
          <RNView style={layoutStyles.navBarTitle}>
            <RNText style={[layoutStyles.navBarTitleText, webTheme.navBarText]}>{t('app.title', 'Resgrid Responder')}</RNText>
          </RNView>
          {isDispatchScreen ? <DashboardViewToggles inHeader /> : null}
        </RNView>

        <RNView style={{ flex: 1, flexDirection: 'row' }} ref={parentRef}>
          {/* Sidebar - simple show/hide */}
          {isOpen ? (
            <RNView style={[layoutStyles.webSidebar, webTheme.sidebar]}>
              <SideMenu onNavigate={handleNavigate} colorScheme={webColorScheme} />
              <RNView style={[layoutStyles.sidebarFooter, webTheme.sidebarFooter]}>
                <TouchableOpacity onPress={() => setIsOpen(false)} style={[layoutStyles.closeButton, webTheme.closeButton]}>
                  <RNText style={[layoutStyles.closeButtonText, webTheme.closeButtonText]}>{t('menu.close', 'Close Menu')}</RNText>
                </TouchableOpacity>
              </RNView>
            </RNView>
          ) : null}

          {/* Main content area */}
          <RNView style={[layoutStyles.mainContent, webTheme.mainContent]}>
            <Slot />
          </RNView>
        </RNView>
      </RNView>
    ) : (
      <View style={styles.container}>
        {/* Top Navigation Bar */}
        <View className="flex-row items-center justify-between bg-primary-600 px-4" style={{ paddingTop: insets.top }}>
          <CreateDrawerMenuButton setIsOpen={setIsOpen} />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-white">{t('app.title', 'Resgrid Responder')}</Text>
          </View>
          {isDispatchScreen ? <DashboardViewToggles inHeader onColoredBg /> : null}
        </View>

        <View className="flex-1" ref={parentRef}>
          {/* Native drawer implementation */}
          <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)}>
            <DrawerBackdrop onPress={() => setIsOpen(false)} />
            <DrawerContent className="w-4/5 max-w-xs bg-white p-0 dark:bg-gray-900">
              <View className="flex-1">
                <SideMenu onNavigate={handleNavigate} />
              </View>
              <DrawerFooter>
                <Button onPress={() => setIsOpen(false)} className="w-full bg-primary-600">
                  <ButtonText>Close</ButtonText>
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          {/* Main content area */}
          <View className="w-full flex-1">
            <Slot />
          </View>
        </View>
      </View>
    );

  // On web, skip Novu integration as it may cause rendering issues
  if (Platform.OS === 'web') {
    logger.info({
      message: 'Rendering app layout for web platform (Novu disabled)',
    });
    return content;
  }

  return (
    <>
      {userId && config && rights?.DepartmentCode ? (
        <NovuProvider subscriberId={`${rights?.DepartmentCode}_User_${userId}`} applicationIdentifier={config.NovuApplicationId} backendUrl={config.NovuBackendApiUrl} socketUrl={config.NovuSocketUrl}>
          {/* NotificationInbox at the root level */}
          <NotificationInbox isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
          {content}
        </NovuProvider>
      ) : (
        content
      )}
    </>
  );
}

interface CreateDrawerMenuButtonProps {
  setIsOpen: (isOpen: boolean) => void;
  colorScheme?: 'light' | 'dark';
}

const CreateDrawerMenuButton = ({ setIsOpen, colorScheme }: CreateDrawerMenuButtonProps) => {
  // Use React Native primitives on web to avoid infinite render loops from gluestack-ui/lucide
  if (Platform.OS === 'web') {
    const isDark = colorScheme === 'dark';
    return (
      <TouchableOpacity onPress={() => setIsOpen(true)} testID="drawer-menu-button" style={layoutStyles.menuButton}>
        <RNText style={[layoutStyles.menuIcon, { color: isDark ? '#f9fafb' : '#030712' }]}>☰</RNText>
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
      className="p-2"
      onPress={() => {
        setIsOpen(true);
      }}
      testID="drawer-menu-button"
    >
      <Menu size={24} color="white" />
    </Pressable>
  );
};

const CreateNotificationButton = ({
  config,
  setIsNotificationsOpen,
  userId,
  departmentCode,
}: {
  config: GetConfigResultData | null;
  setIsNotificationsOpen: (isOpen: boolean) => void;
  userId: string | null;
  departmentCode: string | undefined;
}) => {
  if (!userId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl || !departmentCode) {
    return null;
  }

  return <NotificationButton onPress={() => setIsNotificationsOpen(true)} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

const layoutStyles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  navBarTitle: {
    flex: 1,
    alignItems: 'center',
  },
  navBarTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  menuButton: {
    padding: 8,
    borderRadius: 6,
  },
  menuIcon: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  webSidebar: {
    width: 280,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    padding: 16,
  },
  mainContent: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
