import { type ChatMentionInput } from './chatInputs';

/**
 * A pending outbound message persisted to MMKV so unsent messages survive an
 * app restart / reconnect. Keyed by a client-generated ClientMessageId which
 * the server treats as an idempotency key, so draining the outbox is a safe
 * resend.
 */
export interface ChatOutboxItem {
  ClientMessageId: string;
  ChannelId: string;
  Body: string;
  MessageType: number;
  Priority: number;
  AsUnitId?: number;
  AsIncidentCommander?: boolean;
  ThreadRootMessageId?: string;
  AlsoSendToChannel?: boolean;
  MetadataJson?: string;
  Mentions?: ChatMentionInput[];
  /** Snapshot of the sender display name for optimistic rendering. */
  SenderDisplayName?: string;
  /** Sender user id for optimistic rendering. */
  SenderUserId?: string;
  CreatedAt: number;
}
