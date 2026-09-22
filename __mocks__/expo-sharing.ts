// Mock for expo-sharing: the native module is not available under Jest, and any screen that
// pulls in the contact files list (call detail via the Site Info tab) imports it at module load.
export const isAvailableAsync = jest.fn().mockResolvedValue(true);

export const shareAsync = jest.fn().mockResolvedValue(undefined);
