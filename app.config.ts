/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';
import * as fs from 'fs';
import * as path from 'path';

import { ClientEnv, Env } from './env';
const packageJSON = require('./package.json');

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.NAME,
  description: `${Env.NAME} Resgrid Dispatch`,
  owner: Env.EXPO_ACCOUNT_OWNER,
  scheme: Env.SCHEME,
  slug: 'resgrid-dispatch',
  version: packageJSON.version,
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    icon: './assets/ios-icon.png',
    version: packageJSON.version,
    buildNumber: packageJSON.version,
    supportsTablet: true,
    bundleIdentifier: Env.BUNDLE_ID,
    requireFullScreen: true,
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'audio', 'bluetooth-central', 'voip'],
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: false,
      NSBluetoothAlwaysUsageDescription: 'Allow Resgrid Dispatch to connect to bluetooth devices for PTT.',
      LSApplicationQueriesSchemes: [Env.SCHEME, 'https', 'http'],
    },
    entitlements: {
      ...((Env.APP_ENV === 'production' || Env.APP_ENV === 'internal') && {
        'com.apple.developer.usernotifications.critical-alerts': true,
        'com.apple.developer.usernotifications.time-sensitive': true,
      }),
    },
  },
  experiments: {
    typedRoutes: true,
    baseUrl: '/',
  },
  android: {
    version: packageJSON.version,
    versionCode: parseInt(packageJSON.versionCode),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2484c4',
    },
    // 'pan' makes Android scroll the window under the IME on its own, which fights
    // react-native-keyboard-controller. Its hooks flip the activity to adjustResize on
    // mount and call setDefaultMode() on unmount, restoring whatever this value is — so
    // with 'pan' any closing sheet or modal drops the app back into pan mode and inputs
    // end up under the keyboard. Edge-to-edge means the OS no longer resizes for us
    // either, so 'resize' leaves keyboard avoidance entirely to the library.
    softwareKeyboardLayoutMode: 'resize',
    package: Env.PACKAGE,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: Env.SCHEME }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    ...(fs.existsSync(path.join(__dirname, 'google-services.json')) && {
      googleServicesFile: 'google-services.json',
    }),
    permissions: [
      'android.permission.WAKE_LOCK',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAPTURE_AUDIO_OUTPUT',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2a7dd5',
        image: './assets/adaptive-icon.png',
        imageWidth: 250,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Inter.ttf'],
      },
    ],
    'expo-localization',
    'expo-router',
    ['react-native-edge-to-edge'],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2a7dd5',
        permissions: {
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        },
        sounds: [
          'assets/audio/notification.wav',
          'assets/audio/callclosed.wav',
          'assets/audio/callupdated.wav',
          'assets/audio/callemergency.wav',
          'assets/audio/callhigh.wav',
          'assets/audio/calllow.wav',
          'assets/audio/callmedium.wav',
          'assets/audio/newcall.wav',
          'assets/audio/newchat.wav',
          'assets/audio/newmessage.wav',
          'assets/audio/newshift.wav',
          'assets/audio/newtraining.wav',
          'assets/audio/personnelstaffingupdated.wav',
          'assets/audio/personnelstatusupdated.wav',
          'assets/audio/troublealert.wav',
          'assets/audio/unitnotice.wav',
          'assets/audio/unitstatusupdated.wav',
          'assets/audio/upcomingshift.wav',
          'assets/audio/upcomingtraining.wav',
          'assets/audio/modernnotification.wav',
          'assets/audio/moderncallclosed.wav',
          'assets/audio/moderncallupdated.wav',
          'assets/audio/moderncallemergency.wav',
          'assets/audio/moderncallhigh.wav',
          'assets/audio/moderncalllow.wav',
          'assets/audio/moderncallmedium.wav',
          'assets/audio/modernchat.wav',
          'assets/audio/modernmessage.wav',
          'assets/audio/modernshift.wav',
          'assets/audio/moderntraining.wav',
          'assets/audio/modernpersonnelstatus.wav',
          'assets/audio/modernstaffing.wav',
          'assets/audio/moderntroublealert.wav',
          'assets/audio/modernunitnotice.wav',
          'assets/audio/modernunitstatus.wav',
          'assets/audio/modernavailabilityalert.wav',
          'assets/audio/moderncalendar.wav',
          'assets/audio/modernresourceorder.wav',
          'assets/audio/modernweatheralert.wav',
          'assets/audio/custom/c1.wav',
          'assets/audio/custom/c2.wav',
          'assets/audio/custom/c3.wav',
          'assets/audio/custom/c4.wav',
          'assets/audio/custom/c5.wav',
          'assets/audio/custom/c6.wav',
          'assets/audio/custom/c7.wav',
          'assets/audio/custom/c8.wav',
          'assets/audio/custom/c9.wav',
          'assets/audio/custom/c10.wav',
          'assets/audio/custom/c11.wav',
          'assets/audio/custom/c12.wav',
          'assets/audio/custom/c13.wav',
          'assets/audio/custom/c14.wav',
          'assets/audio/custom/c15.wav',
          'assets/audio/custom/c16.wav',
          'assets/audio/custom/c17.wav',
          'assets/audio/custom/c18.wav',
          'assets/audio/custom/c19.wav',
          'assets/audio/custom/c20.wav',
          'assets/audio/custom/c21.wav',
          'assets/audio/custom/c22.wav',
          'assets/audio/custom/c23.wav',
          'assets/audio/custom/c24.wav',
          'assets/audio/custom/c25.wav',
        ],
        requestPermissions: true,
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.8.0',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Resgrid Dispatch to show current location on map.',
        locationAlwaysAndWhenInUsePermission: 'Allow Resgrid Dispatch to use your location for department updates.',
        locationAlwaysPermission: 'Resgrid Dispatch needs to track your location for department AVL.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        taskManager: {
          locationTaskName: 'location-updates',
          locationTaskOptions: {
            accuracy: 'balanced',
            distanceInterval: 10,
            timeInterval: 5000,
          },
        },
      },
    ],
    [
      'expo-task-manager',
      {
        taskManager: {
          taskName: 'location-updates',
        },
      },
    ],
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'DEFAULT',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraProguardRules: '-keep class expo.modules.location.** { *; }',
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
          targetSdkVersion: 35,
        },
        ios: {
          deploymentTarget: '18.1',
        },
      },
    ],
    [
      'expo-asset',
      {
        assets: [
          'assets/mapping',
          'assets/audio/ui/space_notification1.mp3',
          'assets/audio/ui/space_notification2.mp3',
          'assets/audio/ui/positive_interface_beep.mp3',
          'assets/audio/ui/software_interface_start.mp3',
          'assets/audio/ui/software_interface_back.mp3',
        ],
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'sentry',
        project: 'unit',
        url: 'https://sentry.resgrid.net/',
      },
    ],
    [
      'expo-navigation-bar',
      {
        position: 'relative',
        visibility: 'hidden',
        behavior: 'inset-touch',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow Resgrid Dispatch to access the microphone for audio input used in PTT and calls.',
      },
    ],
    'react-native-ble-manager',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    '@config-plugins/react-native-callkeep',
    'expo-web-browser',
    './customGradle.plugin.js',
    './customManifest.plugin.js',
    ['app-icon-badge', appIconBadgeConfig],
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
