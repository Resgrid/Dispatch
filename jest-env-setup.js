// Must run before jest-expo's preset setup requires `expo/src/winter`.
// Uses React Native's fetch in tests instead of expo's winter fetch, whose
// FetchResponse extends a native class that is unavailable after jest teardown.
process.env.EXPO_PUBLIC_USE_RN_FETCH = '1';
