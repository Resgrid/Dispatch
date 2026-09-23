import type { Href } from 'expo-router';

import { isSafeRouteId, parseNotificationData } from '@/stores/push-notification/store';

export type InboxReferenceType = 'call' | 'chat';

export interface InboxReference {
  referenceType: InboxReferenceType;
  referenceId: string;
}

/**
 * The item a Novu inbox notification links to, read from the push event code the Novu bridge copies
 * into the in-app `data`: "C{callId}" for call dispatches, "t:{channelId}" / "g:{channelId}" for chat.
 * Ids that could steer the router elsewhere are refused, as the push handlers do.
 */
export const referenceFromEventCode = (eventCode: unknown): InboxReference | undefined => {
  if (typeof eventCode !== 'string') return undefined;
  const call = /^C:?(\d+)$/i.exec(eventCode);
  if (call) return { referenceType: 'call', referenceId: call[1] };
  const parsed = parseNotificationData({ eventCode });
  if ((parsed.type === 'chat' || parsed.type === 'group-chat') && isSafeRouteId(parsed.id)) return { referenceType: 'chat', referenceId: parsed.id };
  return undefined;
};

/** The screen an inbox reference opens, or null when this app has none for it. */
export const referenceHref = (referenceType: string, referenceId: string): Href | null => {
  if (!isSafeRouteId(referenceId)) return null;
  if (referenceType === 'call') return { pathname: '/call/[id]', params: { id: referenceId } };
  if (referenceType === 'chat') return { pathname: '/chat/[channelId]', params: { channelId: referenceId } };
  return null;
};
