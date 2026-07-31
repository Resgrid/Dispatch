import { type StateStorage } from 'zustand/middleware';

const isLocalStorageAvailable = typeof localStorage !== 'undefined';

// Mock MMKV class for web to satisfy type requirements if needed,
// but we won't export 'storage' as MMKV type to avoid importing the native library if possible.
// However, other files might expect 'storage' to be exported.
// Let's export a dummy object or just 'any'.
export const storage: any = {
  getString: (key: string) => {
    if (!isLocalStorageAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage.getItem failed', e);
      return null;
    }
  },
  getNumber: (key: string): number | undefined => {
    if (!isLocalStorageAvailable) return undefined;
    try {
      const value = localStorage.getItem(key);
      if (value === null) return undefined;
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    } catch (e) {
      console.warn('localStorage.getNumber failed', e);
      return undefined;
    }
  },
  getBoolean: (key: string): boolean | undefined => {
    if (!isLocalStorageAvailable) return undefined;
    try {
      const value = localStorage.getItem(key);
      if (value === null) return undefined;
      return value === 'true';
    } catch (e) {
      console.warn('localStorage.getBoolean failed', e);
      return undefined;
    }
  },
  set: (key: string, value: string | number | boolean) => {
    if (!isLocalStorageAvailable) return;
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {
      console.warn('localStorage.setItem failed', e);
    }
  },
  delete: (key: string) => {
    if (!isLocalStorageAvailable) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage.removeItem failed', e);
    }
  },
  clearAll: () => {
    if (!isLocalStorageAvailable) return;
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('localStorage.clearAll failed', e);
    }
  },
  getAllKeys: (): string[] => {
    if (!isLocalStorageAvailable) return [];
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch (e) {
      console.warn('localStorage.getAllKeys failed', e);
      return [];
    }
  },
  contains: (key: string): boolean => {
    if (!isLocalStorageAvailable) return false;
    try {
      return localStorage.getItem(key) !== null;
    } catch (e) {
      return false;
    }
  },
};

export function getItem<T>(key: string): T | null {
  try {
    if (!isLocalStorageAvailable) return null;
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error('Error reading from localStorage', e);
    return null;
  }
}

export async function setItem<T>(key: string, value: T) {
  try {
    if (!isLocalStorageAvailable) return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

export async function removeItem(key: string) {
  try {
    if (!isLocalStorageAvailable) return;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error removing from localStorage', e);
  }
}

export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    try {
      if (isLocalStorageAvailable) localStorage.setItem(name, value);
    } catch (e) {
      console.error('Local storage setItem failed', e);
    }
  },
  getItem: (name) => {
    if (!isLocalStorageAvailable) return null;
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn('localStorage.getItem failed', e);
      return null;
    }
  },
  removeItem: (name) => {
    if (!isLocalStorageAvailable) return;
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('localStorage.removeItem failed', e);
    }
  },
};

export const useIsFirstTime = () => {
  // On web platform, we never show onboarding, so always return false
  // This ensures onboarding is only displayed on iOS and Android apps
  const setFirstTime = (_value: boolean | undefined) => {
    // No-op on web since we skip onboarding
  };

  return [false, setFirstTime] as const;
};
