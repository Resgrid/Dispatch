import { create } from 'zustand';

import { logger } from '@/lib/logging';
import { audioService } from '@/services/audio.service';

export interface PushNotificationData {
  eventCode: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export type NotificationType = 'call' | 'message' | 'chat' | 'group-chat' | 'unknown';

export interface ParsedNotification {
  type: NotificationType;
  id: string;
  eventCode: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface PushNotificationModalState {
  isOpen: boolean;
  notification: ParsedNotification | null;
  showNotificationModal: (notificationData: PushNotificationData) => void;
  hideNotificationModal: () => void;
  parseNotification: (notificationData: PushNotificationData) => ParsedNotification;
}

// First character of the event code prefix sent by the Resgrid backend, e.g.
// "C:1234" call, "M:5678" message, "t:9012" chat, "g:3456" group chat.
const EVENT_CODE_PREFIXES: Record<string, NotificationType> = {
  c: 'call',
  m: 'message',
  t: 'chat',
  g: 'group-chat',
};

/**
 * Ids parsed out of a push event code are attacker-influenced and land straight in a route
 * path, so anything that could steer the router elsewhere — a path separator, a query, a
 * fragment — disqualifies the id. Shared by the deep-link handlers and the notification modal
 * so a tap and a cold-start deep-link accept exactly the same ids.
 */
export const isSafeRouteId = (id: string): boolean => id.length > 0 && !/[/\\?#]/.test(id);

export const parseNotificationData = (notificationData: PushNotificationData): ParsedNotification => {
  const eventCode = notificationData.eventCode || '';
  let type: NotificationType = 'unknown';
  let id = '';

  const separatorIndex = eventCode.indexOf(':');

  if (separatorIndex > 0) {
    // Split on the FIRST colon only, so an id that itself contains one survives intact.
    const lowerPrefix = eventCode.slice(0, separatorIndex).toLowerCase();
    type = EVENT_CODE_PREFIXES[lowerPrefix.charAt(0)] ?? 'unknown';
    id = eventCode.slice(separatorIndex + 1);
  } else if (separatorIndex === -1 && eventCode.length > 1) {
    // Legacy Core payloads omit the colon (e.g. "C1234" call, "M5678" message):
    // the first character is the type prefix and the remainder is the id.
    const legacyType = EVENT_CODE_PREFIXES[eventCode.charAt(0).toLowerCase()];
    if (legacyType) {
      type = legacyType;
      id = eventCode.slice(1);
    }
  }

  return {
    type,
    id,
    eventCode,
    title: notificationData.title,
    body: notificationData.body,
    data: notificationData.data,
  };
};

export const usePushNotificationModalStore = create<PushNotificationModalState>((set, get) => ({
  isOpen: false,
  notification: null,

  parseNotification: (notificationData: PushNotificationData): ParsedNotification => parseNotificationData(notificationData),

  showNotificationModal: (notificationData: PushNotificationData) => {
    const parsedNotification = get().parseNotification(notificationData);

    logger.info({
      message: 'Showing push notification modal',
      context: {
        type: parsedNotification.type,
        id: parsedNotification.id,
        eventCode: parsedNotification.eventCode,
      },
    });

    // Play notification sound
    audioService.playNotificationSound(parsedNotification.type).catch((error) => {
      logger.error({
        message: 'Failed to play notification sound',
        context: { error, type: parsedNotification.type },
      });
    });

    set({
      isOpen: true,
      notification: parsedNotification,
    });
  },

  hideNotificationModal: () => {
    logger.info({
      message: 'Hiding push notification modal',
    });

    set({
      isOpen: false,
      notification: null,
    });
  },
}));
