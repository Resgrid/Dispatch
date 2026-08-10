// Import  global CSS file
import '../../global.css';
import '../lib/i18n';

import { Env } from '@env';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { FloatingDevTools } from '@react-buoy/core';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { LogBox, Platform, useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APIProvider } from '@/api';
import { CountlyProvider } from '@/components/common/countly-provider';
import { PushNotificationModal } from '@/components/push-notification/push-notification-modal';
import { ToastContainer } from '@/components/toast/toast-container';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { loadKeepAliveState } from '@/lib/hooks/use-keep-alive';
import { loadSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { logger } from '@/lib/logging';
import { getDeviceUuid, setDeviceUuid } from '@/lib/storage/app';
import { uuidv4 } from '@/lib/utils';
import { appInitializationService } from '@/services/app-initialization.service';

export { ErrorBoundary } from 'expo-router';
export const navigationRef = createNavigationContainerRef();

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Construct a new integration instance. This is needed to communicate between the integration and React
const navigationIntegration = Sentry.reactNavigationIntegration({
  // Disable enableTimeToInitialDisplay to prevent fallback timestamp errors
  enableTimeToInitialDisplay: false,
});

// Sentry's own logger is off by default: watchdog-termination tracking rewrites the
// native scope on every RNSentry turbo-module call, so `debug` floods the Metro
// console with hundreds of "Writing tags to disk" lines a second. Flip to `__DEV__`
// temporarily when diagnosing Sentry itself.
const SENTRY_DEBUG = false;

// Only initialize Sentry if a DSN is provided
if (Env.SENTRY_DSN) {
  Sentry.init({
    dsn: Env.SENTRY_DSN,
    debug: SENTRY_DEBUG,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production to reduce performance impact
    profilesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production to reduce performance impact
    sendDefaultPii: false,
    // Add release and environment information
    release: Env.VERSION,
    environment: Env.APP_ENV || (__DEV__ ? 'development' : 'production'),
    // Add platform as a tag
    initialScope: {
      tags: {
        platform: Platform.OS,
      },
    },
    integrations: [
      // Pass integration
      navigationIntegration,
      // Disable HTTP instrumentation on web platform due to hanging issues
      ...(Platform.OS === 'web'
        ? []
        : [
            // Add other integrations here for native platforms if needed
          ]),
    ],
    enableNativeFramesTracking: Platform.OS !== 'web', // Only enable native frames tracking on native platforms
    // Disable auto-instrumentation on web to prevent fetch/xhr blocking
    ...(Platform.OS === 'web'
      ? {
          enableAutoPerformanceTracing: false,
          enableAutoSessionTracking: false,
        }
      : {}),
    // Add additional options to prevent timing issues
    beforeSendTransaction(event: any) {
      // Filter out problematic navigation transactions that might cause timestamp errors
      if (event.contexts?.trace?.op === 'navigation' && !event.contexts?.trace?.data?.route) {
        return null;
      }
      return event;
    },
    beforeSend(event, hint) {
      // Add additional context for web platform
      if (Platform.OS === 'web') {
        event.tags = {
          ...event.tags,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        };
      }
      return event;
    },
  });
} else if (__DEV__) {
  console.log('Sentry DSN not configured - error tracking disabled');
}

// Initialize LiveKit for the current platform
//initializeLiveKitForPlatform();

// Load the selected theme from storage and apply it
loadSelectedTheme();

//useAuth().hydrate();
// Prevent the splash screen from auto-hiding before asset loading is complete.
//SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
//SplashScreen.setOptions({
//  duration: 1000,
//  fade: true,
//});

const deviceUuid = getDeviceUuid();
if (!deviceUuid) {
  setDeviceUuid(uuidv4());
}

LogBox.ignoreLogs([
  //Mapbox errors
  'Mapbox [error] ViewTagResolver | view:',
  // Ignore Sentry fallback timestamp warnings in development
  'Sentry Logger [error]: Failed to receive any fallback timestamp',
]);

function RootLayout() {
  // Capture the NavigationContainer ref and register it with the integration.
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }

    // Skip all native initialization on web platform
    if (Platform.OS === 'web') {
      return;
    }

    // Skip initialization in Expo Go
    if (isRunningInExpoGo()) {
      return;
    }

    // Clear the badge count on app startup (native only)
    Notifications.setBadgeCountAsync(0)
      .then(() => {
        logger.info({
          message: 'Badge count cleared on startup',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to clear badge count on startup',
          context: { error },
        });
      });

    // Load keep alive state on app startup (native only)
    loadKeepAliveState()
      .then(() => {
        logger.info({
          message: 'Keep alive state loaded on startup',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to load keep alive state on startup',
          context: { error },
        });
      });

    // Initialize global app services (native only)
    appInitializationService
      .initialize()
      .then(() => {
        logger.info({
          message: 'Global app services initialized successfully',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to initialize global app services',
          context: { error },
        });
      });
  }, [ref]);

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login/index" options={{ headerShown: false }} />
        <Stack.Screen name="lockscreen" options={{ headerShown: false }} />
        <Stack.Screen name="maintenance" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();

  const renderContent = () => (
    <APIProvider>
      <GluestackUIProvider mode={(colorScheme ?? 'light') as 'light' | 'dark'}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {Platform.OS === 'web' ? (
            <>
              {children}
              <PushNotificationModal />
              <FlashMessage position="top" />
              <ToastContainer />
            </>
          ) : (
            <BottomSheetModalProvider>
              {children}
              <PushNotificationModal />
              <FlashMessage position="top" />
              <ToastContainer />
            </BottomSheetModalProvider>
          )}
        </ThemeProvider>
      </GluestackUIProvider>
    </APIProvider>
  );

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <KeyboardProvider>
          {Env.COUNTLY_APP_KEY ? (
            <CountlyProvider appKey={Env.COUNTLY_APP_KEY} serverURL={Env.COUNTLY_SERVER_URL}>
              {renderContent()}
            </CountlyProvider>
          ) : (
            renderContent()
          )}
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
