import { Env } from '@env';
import { Platform } from 'react-native';

interface CountlyEvents {
  recordEvent: (eventName: string, segmentation: Record<string, string>, count: number) => void;
}

interface CountlyInterface {
  events: CountlyEvents;
  init?: (config: any) => Promise<void>;
  initWithConfig?: (config: any) => Promise<void>;
  start?: () => Promise<void>;
  enableCrashReporting?: () => Promise<void>;
}

// Persisted random device id for the web sender (analytics must never throw)
const getWebDeviceId = (): string => {
  try {
    const stored = window.localStorage.getItem('countly_device_id');
    if (stored) return stored;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem('countly_device_id', id);
    return id;
  } catch {
    return 'unknown';
  }
};

const sendWebEvent = (eventName: string, segmentation: Record<string, string>, count: number): void => {
  try {
    const appKey = Env.COUNTLY_APP_KEY;
    const serverUrl = Env.COUNTLY_SERVER_URL;
    if (!appKey || !serverUrl || typeof fetch === 'undefined') return;

    const params = new URLSearchParams({
      app_key: appKey,
      device_id: getWebDeviceId(),
      events: JSON.stringify([{ key: eventName, count, segmentation }]),
    });

    fetch(`${serverUrl}/i?${params.toString()}`, { method: 'POST', keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never throw
  }
};

/**
 * Platform-aware Countly wrapper
 * Provides a minimal direct-post implementation for web platform
 */
let Countly: CountlyInterface;

if (Platform.OS === 'web') {
  Countly = {
    events: {
      recordEvent: sendWebEvent,
    },
    init: async () => {
      // No-op - the web sender reads config lazily per event
    },
    initWithConfig: async () => {
      // No-op
    },
    start: async () => {
      // No-op
    },
    enableCrashReporting: async () => {
      // No-op
    },
  };
} else {
  // Native platforms (iOS/Android)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Countly = require('countly-sdk-react-native-bridge').default;
}

export default Countly;
