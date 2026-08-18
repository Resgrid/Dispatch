import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerUnitDevice } from '@/api/devices/push';
import { useAuthStore } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { routerPushWithRetry } from '@/lib/navigation';
import { isNativePushSupported } from '@/lib/platform';
import { storage } from '@/lib/storage';
import { getDeviceUuid } from '@/lib/storage/app';
import { electronNotificationService } from '@/services/electron-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { securityStore } from '@/stores/security/store';

// Define notification response types
export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Handles chat push deep-links. Chat notifications carry an eventCode of
 * "t:{channelId}" (direct message) or "g:{channelId}" (group/channel); both
 * navigate to the chat conversation route.
 */
export function handleChatDeepLink(eventCode: string): boolean {
  const match = /^([tg]):(.+)$/.exec(eventCode);
  if (!match) return false;
  const channelId = match[2];
  if (/[/\\?#]/.test(channelId)) return false;
  void routerPushWithRetry(
    { pathname: '/chat/[channelId]', params: { channelId } },
    {
      maxAttempts: 40,
      retryDelayMs: 250,
      // On a cold start the session is still hydrating. Pushing a protected route before
      // it settles gets the route replaced by the auth guard, which is indistinguishable
      // from the tap doing nothing at all.
      waitUntil: () => useAuthStore.getState().status === 'signedIn',
    }
  ).catch((error) => {
    logger.error({ message: 'Failed to deep-link to chat channel', context: { error, eventCode } });
  });
  return true;
}

// Storage key for the Android "use modern notification sounds" preference.
// Android-only; defaults to enabled (modern sounds) when no preference is saved.
export const MODERN_NOTIFICATION_SOUNDS_ENABLED = 'MODERN_NOTIFICATION_SOUNDS_ENABLED';

/**
 * Whether the modern notification sounds preference is enabled. Android-only
 * setting that defaults to true (modern sounds) when the user has not changed it.
 */
export const getModernNotificationSoundsEnabled = (): boolean => storage.getBoolean(MODERN_NOTIFICATION_SOUNDS_ENABLED) ?? true;

interface ManagedNotificationChannel {
  id: string;
  name: string;
  description: string;
  /** Sound resource (res/raw name, no extension) used when modern sounds are enabled. */
  modernSound?: string;
  /** Sound resource used when modern sounds are disabled (the classic/legacy sound). */
  classicSound?: string;
  vibration?: boolean;
}

// Channels whose sound switches between the modern and classic sets based on the
// MODERN_NOTIFICATION_SOUNDS_ENABLED preference. Custom call channels (c1-c25)
// use user-defined tones and are created separately, unaffected by this toggle.
const MANAGED_NOTIFICATION_CHANNELS: ManagedNotificationChannel[] = [
  { id: 'calls', name: 'Generic Call', description: 'Generic Call', modernSound: 'modernnotification' },
  { id: '0', name: 'Emergency Call', description: 'Emergency Call', modernSound: 'moderncallemergency', classicSound: 'callemergency' },
  { id: '1', name: 'High Call', description: 'High Call', modernSound: 'moderncallhigh', classicSound: 'callhigh' },
  { id: '2', name: 'Medium Call', description: 'Medium Call', modernSound: 'moderncallmedium', classicSound: 'callmedium' },
  { id: '3', name: 'Low Call', description: 'Low Call', modernSound: 'moderncalllow', classicSound: 'calllow' },
  { id: 'notif', name: 'Notification', description: 'Notifications', modernSound: 'modernnotification', vibration: false },
  { id: 'message', name: 'Message', description: 'Messages', modernSound: 'modernmessage', vibration: false },
];

// Configure notifications behavior – only on native platforms where
// expo-notifications is fully supported (iOS / Android).
if (isNativePushSupported()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private pushToken: string | null = null;
  private notificationListener: { remove: () => void } | null = null;
  private responseListener: { remove: () => void } | null = null;
  // A launch tap reaches both getLastNotificationResponseAsync and the response listener;
  // dedupe on the request identifier so it is only acted on once.
  private lastHandledResponseId: string | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async createNotificationChannel(id: string, name: string, description: string, sound?: string, vibration: boolean = true): Promise<void> {
    await Notifications.setNotificationChannelAsync(id, {
      name,
      description,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: vibration ? [0, 250, 250, 250] : undefined,
      sound,
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  private async setupAndroidNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Pick the modern or classic sound set based on the user preference (defaults to modern).
        const useModernSounds = getModernNotificationSoundsEnabled();

        // Standard call / message / notification channels
        for (const channel of MANAGED_NOTIFICATION_CHANNELS) {
          const sound = useModernSounds ? channel.modernSound : channel.classicSound;
          await this.createNotificationChannel(channel.id, channel.name, channel.description, sound, channel.vibration ?? true);
        }

        // Custom call channels (c1-c25) - user-defined tones, unaffected by the modern/classic toggle
        for (let i = 1; i <= 25; i++) {
          const channelId = `c${i}`;
          await this.createNotificationChannel(channelId, `Custom Call ${i}`, `Custom Call Tone ${i}`, channelId);
        }

        logger.info({
          message: 'Android notification channels setup completed',
          context: { useModernSounds },
        });
      } catch (error) {
        logger.error({
          message: 'Error setting up Android notification channels',
          context: { error },
        });
      }
    }
  }

  /**
   * Recreates the managed Android notification channels so a change to the
   * modern/classic sound preference takes effect. Android notification channels
   * are immutable once created, so the channels must be deleted and recreated
   * for a new sound to apply.
   */
  public async refreshNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      for (const channel of MANAGED_NOTIFICATION_CHANNELS) {
        await Notifications.deleteNotificationChannelAsync(channel.id);
      }

      await this.setupAndroidNotificationChannels();

      logger.info({
        message: 'Android notification channels refreshed',
        context: { useModernSounds: getModernNotificationSoundsEnabled() },
      });
    } catch (error) {
      logger.error({
        message: 'Error refreshing Android notification channels',
        context: { error },
      });
    }
  }

  private async initialize(): Promise<void> {
    if (isNativePushSupported()) {
      // Listeners go on FIRST: awaiting channel setup before registering them let a tap that
      // arrived during startup slip past with nothing listening for it.
      this.notificationListener = Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
      this.responseListener = Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);

      // Set up Android notification channels
      await this.setupAndroidNotificationChannels();

      // A tap that launched the app from a killed state is never delivered to the response
      // listener above — expo-notifications only surfaces it here. Without this, cold-start
      // taps on Dispatch did nothing at all.
      void this.handleLaunchNotification();

      logger.info({
        message: 'Push notification service initialized (native)',
      });
    } else if (Platform.OS === 'web') {
      // On web / Electron, initialize the electron notification service
      // which uses the native OS Notification API.
      await electronNotificationService.initialize();

      logger.info({
        message: 'Push notification service initialized (web/electron)',
      });
    }
  }

  private handleNotificationReceived = (notification: Notifications.Notification): void => {
    const data = notification.request.content.data;

    logger.info({
      message: 'Notification received',
      context: {
        data,
      },
    });

    // Check if the notification has an eventCode and show modal
    // eventCode must be a string to be valid
    if (data?.eventCode && typeof data.eventCode === 'string') {
      const notificationData = {
        eventCode: data.eventCode as string,
        title: notification.request.content.title || undefined,
        body: notification.request.content.body || undefined,
        data,
      };

      // Show the notification modal using the store
      usePushNotificationModalStore.getState().showNotificationModal(notificationData);
    }
  };

  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    this.handleResponseOnce(response);
  };

  /**
   * The launch notification (app opened from a killed state by a tap) is only available
   * through getLastNotificationResponseAsync. The same tap can also reach the response
   * listener, so both routes funnel through handleResponseOnce, which dedupes on the
   * request identifier.
   */
  private async handleLaunchNotification(): Promise<void> {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) {
        return;
      }

      logger.info({
        message: 'App opened from notification (killed state)',
        context: { data: response.notification.request.content.data },
      });

      this.handleResponseOnce(response);
    } catch (error) {
      logger.error({
        message: 'Error checking initial notification',
        context: { error },
      });
    }
  }

  private handleResponseOnce(response: Notifications.NotificationResponse): void {
    const identifier = response.notification.request.identifier;
    if (identifier && identifier === this.lastHandledResponseId) {
      return;
    }
    this.lastHandledResponseId = identifier ?? this.lastHandledResponseId;

    const content = response.notification.request.content;
    const data = content.data;

    logger.info({
      message: 'Notification response received',
      context: {
        data,
      },
    });

    // Deep-link chat notifications: eventCode "t:{channelId}" (DM) / "g:{channelId}" (group)
    if (data?.eventCode && typeof data.eventCode === 'string') {
      if (handleChatDeepLink(data.eventCode)) {
        return;
      }

      // Every other type mirrors the foreground behaviour so the tap surfaces the
      // notification instead of opening the app to nothing.
      usePushNotificationModalStore.getState().showNotificationModal({
        eventCode: data.eventCode,
        title: content.title || undefined,
        body: content.body || undefined,
        data,
      });
    }
  }

  public async registerForPushNotifications(unitId: string, departmentCode: string): Promise<string | null> {
    // On web / Electron, push token registration is not available.
    // Desktop notifications are handled by ElectronNotificationService.
    if (!isNativePushSupported()) {
      logger.info({
        message: 'Push token registration skipped – not a native platform',
        context: { platform: Platform.OS },
      });

      // Ensure the electron notification service is initialized
      if (Platform.OS === 'web') {
        await electronNotificationService.initialize();
      }

      return null;
    }

    if (!Device.isDevice) {
      logger.warn({
        message: 'Push notifications are not available on simulator/emulator',
      });
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.warn({
          message: 'Failed to get push notification permissions',
          context: { status: finalStatus },
        });
        return null;
      }

      // Get the token using the non-Expo push notification service method
      const devicePushToken = await Notifications.getDevicePushTokenAsync();

      // The token format depends on the platform
      const token = Platform.OS === 'ios' ? devicePushToken.data : devicePushToken.data;

      this.pushToken = token as string;

      logger.info({
        message: 'Push notification token obtained',
        context: {
          token: this.pushToken,
          unitId,
          platform: Platform.OS,
        },
      });

      await registerUnitDevice({
        UnitId: unitId,
        Token: this.pushToken,
        Platform: Platform.OS === 'ios' ? 1 : 2,
        DeviceUuid: getDeviceUuid() || '',
        Prefix: departmentCode,
      });

      return this.pushToken;
    } catch (error) {
      logger.error({
        message: 'Error registering for push notifications',
        context: { error },
      });
      return null;
    }
  }

  // Method to send the token to your backend
  private async sendTokenToBackend(token: string, unitId: string): Promise<void> {
    // Implement your API call to register the token with your backend
    // This is where you would associate the token with the unitId
    try {
      // Example implementation:
      // await api.post('/register-push-token', { token, unitId });

      logger.info({
        message: 'Push token registered with backend',
        context: { token, unitId },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to register push token with backend',
        context: { error, token, unitId },
      });
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  public async sendTestNotification(): Promise<void> {
    // On web / Electron, use the desktop notification service
    if (!isNativePushSupported()) {
      if (Platform.OS === 'web') {
        electronNotificationService.sendTestNotification();
      }
      return;
    }

    if (!this.pushToken) {
      logger.warn({
        message: 'Cannot send test notification - no push token available',
      });
      return;
    }

    try {
      // This is a local test notification, not sent through a server
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notification',
          body: 'This is a test notification from Resgrid Dispatch',
          data: { type: 'test', timestamp: new Date().toISOString() },
        },
        trigger: null, // Send immediately
      });

      logger.info({
        message: 'Test notification sent',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to send test notification',
        context: { error },
      });
    }
  }

  public cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Show a desktop notification on Electron. This is intended to be called
   * from SignalR event handlers or other real-time event sources that want to
   * surface an OS-level notification on desktop platforms.
   */
  public showDesktopNotification(title: string, body: string, eventCode?: string, data?: Record<string, unknown>): void {
    if (Platform.OS === 'web') {
      electronNotificationService.showNotification({ title, body, eventCode, data });
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();

// React hook for component usage
export const usePushNotifications = () => {
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const rights = securityStore((state) => state.rights);
  const previousUnitIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only register if we have an active unit ID and it's different from the previous one
    if (rights && activeUnitId && activeUnitId !== previousUnitIdRef.current) {
      pushNotificationService
        .registerForPushNotifications(activeUnitId, rights.DepartmentCode)
        .then((token) => {
          if (token) {
            logger.info({
              message: 'Successfully registered for push notifications',
              context: { unitId: activeUnitId },
            });
          }
        })
        .catch((error) => {
          logger.error({
            message: 'Error in push notification registration hook',
            context: { error },
          });
        });

      previousUnitIdRef.current = activeUnitId;
    }

    // Cleanup function
    return () => {
      // No need to clean up here as the service handles its own cleanup
    };
  }, [activeUnitId, rights]);

  return {
    pushToken: pushNotificationService.getPushToken(),
    sendTestNotification: () => pushNotificationService.sendTestNotification(),
  };
};
