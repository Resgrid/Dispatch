import { Platform } from 'react-native';
import { MMKV, useMMKVBoolean } from 'react-native-mmkv';
import { type StateStorage } from 'zustand/middleware';

export let storage: MMKV;
if (Platform.OS === 'web') {
  storage = new MMKV({
    id: 'ResgridDispatch',
  });
} else {
  storage = new MMKV({
    id: 'ResgridDispatch',
    encryptionKey: '6fab2399-c86a-400d-a16f-af8dc7161ced',
  });
}
const IS_FIRST_TIME = 'IS_FIRST_TIME';

export function getItem<T>(key: string): T | null {
  try {
    const value = storage.getString(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error reading from storage', { key, error });
    return null;
  }
}

export async function setItem<T>(key: string, value: T) {
  storage.set(key, JSON.stringify(value));
}

export async function removeItem(key: string) {
  storage.delete(key);
}

export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    try {
      return storage.set(name, value);
    } catch (error) {
      console.error('Zustand storage: Failed to set item', { name, error });
      // Don't throw - allow the app to continue even if storage fails
    }
  },
  getItem: (name) => {
    try {
      const value = storage.getString(name);
      return value ?? null;
    } catch (error) {
      console.error('Zustand storage: Failed to get item', { name, error });
      return null;
    }
  },
  removeItem: (name) => {
    try {
      return storage.delete(name);
    } catch (error) {
      console.error('Zustand storage: Failed to remove item', { name, error });
      // Don't throw - allow the app to continue even if storage fails
    }
  },
};

export const useIsFirstTime = () => {
  const [isFirstTime, setIsFirstTime] = useMMKVBoolean(IS_FIRST_TIME, storage);
  if (isFirstTime === undefined || isFirstTime === null || isFirstTime === true) {
    return [true, setIsFirstTime] as const;
  }
  return [isFirstTime, setIsFirstTime] as const;
};
