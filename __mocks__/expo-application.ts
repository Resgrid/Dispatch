// Jest stand-in for expo-application, whose native module cannot load under Jest. The values are what the app header
// code reads (client-app.ts); tests that need others mock expo-application themselves, which takes precedence.
export const applicationName = 'Resgrid Dispatch';
export const applicationId = 'com.resgrid.dispatch';
export const nativeApplicationVersion = '1.0.0';
export const nativeBuildVersion = '1';
export const getInstallationTimeAsync = jest.fn(async () => new Date(0));
export const getAndroidId = jest.fn(() => 'test-android-id');
export const getIosIdForVendorAsync = jest.fn(async () => 'test-idfv');
