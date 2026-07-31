import { type ChatMessageLocalStatus } from './chatEnums';

/**
 * Result data types for the Resgrid v4 Chat API. Field names mirror
 * ChatApiModels.cs exactly. Nullable server fields are modelled as optional.
 */

/** Standard v4 API envelope: most Chat endpoints return { Data, ...metadata }. */
export interface ChatV4Response<TData> {
  Data: TData;
  PageSize?: number;
  Status?: string;
  Timestamp?: string;
  Version?: string;
  Node?: string;
  RequestId?: string;
  Environment?: string;
}

/** Envelope for simple write operations that return a Success flag. */
export interface ChatActionResult {
  Success: boolean;
  Status?: string;
}

/** Envelope returned by UploadAttachment. */
export interface ChatAttachmentUploadedResult {
  ChatAttachmentId: string;
  Status?: string;
}

/** Envelope returned by GetPresence. */
export interface GetChatPresenceResult {
  OnlineUserIds: string[];
  Status?: string;
}

/** An emoji reaction on a chat message. */
export interface ChatReactionResultData {
  Emoji: string;
  ParticipantType: number;
  UserId?: string | null;
  UnitId?: number | null;
}

/** Attachment metadata (the binary is downloaded separately). */
export interface ChatAttachmentResultData {
  ChatAttachmentId: string;
  FileName: string;
  ContentType: string;
  Size: number;
}

/** Chat channel data. */
export interface ChatChannelResultData {
  ChatChannelId: string;
  ChannelType: number;
  Name: string;
  Topic?: string | null;
  GroupId?: number | null;
  CallId?: number | null;
  CommandStructureNodeId?: string | null;
  OwnerUserId?: string | null;
  IsArchived: boolean;
  IsLocked: boolean;
  LastMessageSeq: number;
  LastMessageOn?: string | null;
  CreatedOn: string;
  UnreadCount: number;
  NotificationPreference: number;
  MyLastReadSeq: number;
}

/** Chat message data. */
export interface ChatMessageResultData {
  ChatMessageId: string;
  ChatChannelId: string;
  DepartmentId?: number;
  MessageSeq: number;
  SenderParticipantType: number;
  SenderUserId?: string | null;
  SenderUnitId?: number | null;
  SenderDisplayName?: string | null;
  Body?: string | null;
  MessageType: number;
  Priority: number;
  ThreadRootMessageId?: string | null;
  ThreadReplyCount: number;
  LastThreadReplyOn?: string | null;
  AlsoSendToChannel: boolean;
  MetadataJson?: string | null;
  ClientMessageId?: string | null;
  SentOn: string;
  EditedOn?: string | null;
  DeletedOn?: string | null;
  DeletedByUserId?: string | null;
  PinnedOn?: string | null;
  PinnedByUserId?: string | null;
  Reactions: ChatReactionResultData[];
  Attachments: ChatAttachmentResultData[];
  /** Client-only optimistic-send status. Not part of the API contract. */
  _localStatus?: ChatMessageLocalStatus;
  /** Client-only local image/file uri for optimistic attachment rendering. */
  _localAttachmentUri?: string;
}

/** A chat channel member's state. */
export interface ChatMemberResultData {
  ChatChannelMemberId: string;
  ChatChannelId: string;
  ParticipantType: number;
  UserId?: string | null;
  UnitId?: number | null;
  DisplayNameOverride?: string | null;
  IsModerator: boolean;
  JoinedOn: string;
  RemovedOn?: string | null;
  LastReadSeq: number;
  LastReadOn?: string | null;
  LastDeliveredSeq: number;
  MutedUntil?: string | null;
  IsBanned: boolean;
  NotificationPreference: number;
}

/** An acknowledgment row for an urgent chat message. */
export interface ChatAckResultData {
  ChatMessageAckId: string;
  ChatMessageId: string;
  ChatChannelId: string;
  UserId?: string | null;
  UnitId?: number | null;
  RequiredOn: string;
  AcknowledgedOn?: string | null;
}

/** A GIF search hit from the configured provider. */
export interface GifResultData {
  Id: string;
  Title?: string | null;
  PreviewUrl: string;
  GifUrl: string;
  Width: number;
  Height: number;
}

/** Metadata payloads embedded in ChatMessageResultData.MetadataJson. */
export interface ChatLocationMetadata {
  Latitude: number;
  Longitude: number;
  Label?: string;
}

export interface ChatGifMetadata {
  GifUrl: string;
  PreviewUrl?: string;
  Width?: number;
  Height?: number;
  Title?: string;
}

export interface ChatImageMetadata {
  AttachmentId?: string;
  Width?: number;
  Height?: number;
}
