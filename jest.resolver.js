// Reanimated v4 worklets: resolve to the non-native builds in Jest.
// Vendored copy of react-native-worklets/jest/resolver.js (added in worklets
// 0.8.x) — this repo pins react-native-worklets 0.5.1, which does not bundle it.

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const { defaultResolver } = options;
  if (options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets')) {
    const workletOptions = { ...options };
    workletOptions.extensions = workletOptions.extensions?.filter((ext) => !ext.includes('native'));
    options = workletOptions;
  }

  return defaultResolver(request, options);
};
