module.exports = {
  preset: 'jest-expo',
  // Reanimated v4 worklets: resolve to the non-native builds in Jest
  // (vendored — worklets 0.5.1 does not ship jest/resolver.js)
  resolver: '<rootDir>/jest.resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '\\.\\._.*'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/coverage/**', '!**/node_modules/**', '!**/babel.config.js', '!**/jest.setup.js', '!**/docs/**', '!**/cli/**', '!**/ios/**', '!**/android/**', '!**/_*', '!**/._*'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@legendapp/motion|@gluestack-ui|nativewind|react-native-css|expo-audio|@aptabase/.*|@shopify/flash-list))',
  ],
  coverageReporters: ['json-summary', ['text', { file: 'coverage.txt' }], 'cobertura'],
  reporters: [
    'default',
    ['github-actions', { silent: false }],
    'summary',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
  coverageDirectory: '<rootDir>/coverage/',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
