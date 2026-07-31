import { type ChatReactionResultData } from './chatModels';

/**
 * SignalR client-event payload shapes for the chat hub. Most events arrive as a
 * JSON string that parses to one of these; chatTyping and chatPresenceChanged
 * arrive as already-deserialized objects. Handlers parse defensively, so these
 * types document the expected shape rather than a strict contract.
 */

export interface ChatMessageDeletedEvent {
  ChatMessageId: string;
  ChatChannelId: string;
  DeletedOn?: string;
  DeletedByUserId?: string;
}

export interface ChatReactionUpdatedEvent {
  ChatMessageId: string;
  ChatChannelId: string;
  Reactions: ChatReactionResultData[];
}

export interface ChatReceiptUpdatedEvent {
  ChatChannelId: string;
  UserId?: string;
  UnitId?: number;
  Seq: number;
}

export interface ChatThreadUpdatedEvent {
  ChatChannelId: string;
  ThreadRootMessageId: string;
  ThreadReplyCount: number;
  LastThreadReplyOn?: string;
}

export interface ChatModerationAppliedEvent {
  ChatChannelId: string;
  ChatMessageId?: string;
  ActionType: number;
  Reason?: string;
}

export interface ChatTypingEvent {
  ChatChannelId: string;
  UserId?: string;
  DisplayName?: string;
  IsTyping: boolean;
}

export interface ChatPresenceChangedEvent {
  UserId: string;
  IsOnline: boolean;
}

export interface ChatbotTypingEvent {
  ChatChannelId: string;
  IsTyping: boolean;
}
