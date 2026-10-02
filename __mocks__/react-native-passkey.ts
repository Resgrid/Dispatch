// Jest stand-in for react-native-passkey (a native module). Tests set the results they need on these mocks.
export const Passkey = {
  isSupported: jest.fn(() => true),
  get: jest.fn(),
  create: jest.fn(),
  getPlatformKey: jest.fn(),
  createPlatformKey: jest.fn(),
};
