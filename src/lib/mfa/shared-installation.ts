import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { storage } from '@/lib/storage';

/**
 * Whether this installation is a shared device (passkey plan section 10.5), and the label its sessions carry. An
 * installation setting, not a user setting: it survives sign-out, and it only ever asks the server for the stricter
 * shared session (department policy can make any session shared anyway).
 */
export const SHARED_INSTALLATION_STORAGE_KEY = 'SHARED_INSTALLATION';

export interface SharedInstallationSetting {
  /** False until someone chooses on the shared device screen; a device nobody has set up is a personal one. */
  configured: boolean;
  shared: boolean;
  /** Shown in the member's session list and on the approver's screen instead of the device model ("Engine 12 MDT"). */
  label: string | null;
}

const MAX_LABEL_LENGTH = 64;

export const sanitizeInstallationLabel = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_LABEL_LENGTH).trim();
};

const NOT_CONFIGURED: SharedInstallationSetting = { configured: false, shared: false, label: null };

const parseSetting = (raw: string | undefined): SharedInstallationSetting => {
  try {
    if (!raw) {
      return NOT_CONFIGURED;
    }
    const parsed = JSON.parse(raw) as Partial<SharedInstallationSetting>;
    return { configured: true, shared: parsed.shared === true, label: sanitizeInstallationLabel(parsed.label) };
  } catch {
    // An unreadable setting is a personal installation; the server still applies department policy.
    return NOT_CONFIGURED;
  }
};

export const readSharedInstallation = (): SharedInstallationSetting => {
  try {
    return parseSetting(storage.getString(SHARED_INSTALLATION_STORAGE_KEY));
  } catch {
    return NOT_CONFIGURED;
  }
};

/** The setting, re-rendering when it changes (the shared device screen saves it while the login screen stays mounted). */
export const useSharedInstallation = (): SharedInstallationSetting => {
  const [raw] = useMMKVString(SHARED_INSTALLATION_STORAGE_KEY, storage);
  return useMemo(() => parseSetting(raw), [raw]);
};

export const isSharedInstallation = (): boolean => readSharedInstallation().shared;

export const saveSharedInstallation = (setting: { shared: boolean; label: string | null }): SharedInstallationSetting => {
  const saved = { shared: setting.shared === true, label: sanitizeInstallationLabel(setting.label) };
  storage.set(SHARED_INSTALLATION_STORAGE_KEY, JSON.stringify(saved));
  return { configured: true, ...saved };
};
