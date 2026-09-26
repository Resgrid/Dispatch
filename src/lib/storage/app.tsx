import { Env } from '@env';

import { getItem, removeItem, setItem } from '@/lib/storage';

const BASE_URL = 'baseUrl';
const DEVICE_UUID = 'unitDeviceUuid';

// The selected server URL is persisted in MMKV on native and localStorage on web/Electron, so it
// survives app restarts and leaving/returning to the site. Only an explicit save changes it.
const normalizeStoredApiUrl = (value: string) => value.trim().replace(/\/+$/, '');

export const removeBaseApiUrl = () => removeItem(BASE_URL);
export const setBaseApiUrl = (value: string) => setItem<string>(BASE_URL, normalizeStoredApiUrl(value));

export const getBaseApiUrl = () => {
  const baseUrl = getItem<string>(BASE_URL);
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return normalizeStoredApiUrl(`${Env.BASE_API_URL}/api/${Env.API_VERSION}`);
  }
  return normalizeStoredApiUrl(baseUrl);
};

export const removeDeviceUuid = () => removeItem(DEVICE_UUID);
export const setDeviceUuid = (value: string) => setItem<string>(DEVICE_UUID, value);

export const getDeviceUuid = () => {
  const uuid = getItem<string>(DEVICE_UUID);
  return uuid;
};
