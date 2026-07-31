/* eslint-env node */

const _ = require('lodash');
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativewind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname, {
  isCSSEnabled: true,
});

// Exclude electron directory from Metro bundler for Android/iOS
// Electron files use Node.js APIs that don't exist in React Native
const existingBlockList = config.resolver.blockList;
const extraBlocked = [/electron\/.*/];
config.resolver.blockList = existingBlockList
  ? [...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]), ...extraBlocked]
  : extraBlocked;

// 1. Watch all files within the monorepo
// 2. Let Metro know where to resolve packages and in what order
//config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Configure path aliases
//config.resolver.extraNodeModules = {
//  '@': path.resolve(__dirname, 'src'),
//  '@env': path.resolve(__dirname, 'src/lib/env.js'),
//  '@assets': path.resolve(__dirname, 'assets'),
//};

// Add platform-specific resolutions for web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect various native module imports to our mocks on web
  if (platform === 'web') {
    // LiveKit WebRTC mocks
    if (moduleName === '@livekit/react-native-webrtc' || moduleName === '@livekit/react-native') {
      return {
        type: 'empty',
      };
    }

    // Notifee is native-only - mock for web
    if (moduleName === '@notifee/react-native') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, '__mocks__/@notifee/react-native.web.js'),
      };
    }

    // MMKV storage mock for web
    if (moduleName === 'react-native-mmkv') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, '__mocks__/react-native-mmkv.ts'),
      };
    }

    // @gorhom/bottom-sheet depends on reanimated worklets - not available on web
    if (moduleName === '@gorhom/bottom-sheet') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, '__mocks__/@gorhom/bottom-sheet.web.js'),
      };
    }

    // NetInfo - not needed on web, use navigator.onLine instead
    if (moduleName === '@react-native-community/netinfo') {
      return {
        type: 'empty',
      };
    }

    // expo-keep-awake mock for web
    if (moduleName === 'expo-keep-awake') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, '__mocks__/expo-keep-awake.ts'),
      };
    }
  }

  // Ensure you call the default resolver for all other modules
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_conditionNames = _.uniq(config.resolver.unstable_conditionNames.concat('browser', 'require', 'react-native')); // <-- and here we can override what we want

module.exports = withNativewind(config, { inlineRem: 16 });
