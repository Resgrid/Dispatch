import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { readSharedInstallation } from './shared-installation';

/**
 * Which Resgrid app this build is (passkey plan section 10.4). The server binds sign-in transactions, passkeys, brokered
 * SSO and recovery to it, so every call that starts or finishes one of those sends it.
 */
export const RESGRID_CLIENT = 'dispatch';

/** The scheme the server's return-target registry lists for this app's brokered SSO (`resgriddispatch://sso-return`). */
export const SSO_RETURN_SCHEME = 'resgriddispatch';

export const CLIENT_HEADER = 'X-Resgrid-Client';
export const SHARED_INSTALLATION_HEADER = 'X-Resgrid-Shared-Installation';
export const OPERATOR_ACTIVITY_HEADER = 'X-Resgrid-Operator-Activity';

const MAX_HEADER_LENGTH = 64;

/** A header value the platform HTTP stack will send: printable ASCII only, trimmed and bounded. */
export const headerSafe = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
  return ascii.length === 0 ? null : ascii.slice(0, MAX_HEADER_LENGTH).trim();
};

/**
 * The app and installation headers for requests that create or bind a session: the app, whether this is a shared
 * installation, and labels for the member's own session list. Labels are display text only; nothing trusts them.
 */
export const clientHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { [CLIENT_HEADER]: RESGRID_CLIENT };
  const installation = readSharedInstallation();
  if (installation.shared) {
    // Read where a session is created (password, completion and external-token grants), by Sso/Begin (the provider asks
    // who is signing in) and by authenticator setup. It can only make the session stricter.
    headers[SHARED_INSTALLATION_HEADER] = 'true';
  }
  const labels: Record<string, string | null> = {
    'X-Resgrid-Device-Name': headerSafe(installation.label) ?? headerSafe(Device.deviceName ?? Device.modelName),
    'X-Resgrid-Device-Type': headerSafe(Device.modelName),
    'X-Resgrid-Operating-System': headerSafe(`${Platform.OS} ${Device.osVersion ?? ''}`),
    'X-Resgrid-App-Version': headerSafe(Application.nativeApplicationVersion),
  };
  for (const [name, value] of Object.entries(labels)) {
    if (value) {
      headers[name] = value;
    }
  }
  return headers;
};

/**
 * Whether the provider's sign-in should run in a browser session that keeps no cookies. A shared installation
 * always does, so the next operator can never ride on the last one's provider session.
 */
export const ephemeralBrowser = (): boolean => readSharedInstallation().shared;

type HeaderBag = { set?: (name: string, value: string) => unknown } | Record<string, unknown>;

/** Adds the app and installation headers to a request's headers (Axios headers or a plain object). */
export const applyClientHeaders = <T extends HeaderBag>(headers: T): T => {
  for (const [name, value] of Object.entries(clientHeaders())) {
    const set = (headers as { set?: unknown }).set;
    if (typeof set === 'function') {
      set.call(headers, name, value);
    } else {
      (headers as Record<string, unknown>)[name] = value;
    }
  }
  return headers;
};
