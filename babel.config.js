module.exports = function (api) {
  api.cache(true);

  return {
    // NativeWind v5 no longer needs a babel preset or jsxImportSource —
    // styling is wired through the metro transform (react-native-css).
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@env': './src/lib/env.js',
            '@unitools/image': '@unitools/image-expo',
            '@unitools/router': '@unitools/router-expo',
            '@unitools/link': '@unitools/link-expo',
            '@assets': './assets',
          },
          extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
