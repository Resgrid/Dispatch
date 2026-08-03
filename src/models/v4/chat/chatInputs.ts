/**
 * Request body (input) DTOs for the Resgrid v4 Chat API. Field names mirror
 * ChatApiModels.cs exactly.
 */

export interface CreateDirectMessageInput {
  TargetUserId?: string;
  TargetUnitId?: number;
}

export interface CreateAdHocChannelInput {
  Name: string;
  MemberUserIds: string[];
}

export interface UpdateChannelInput {
  Name: string;
  Topic: string;
}

export interface AddMembersInput {
  UserIds: string[];
}

export interface SetNotificationPreferenceInput {
  Preference: number;
}

/** An @mention inside a chat message. */
export interface ChatMentionInput {
  MentionType: number;
  TargetUserId?: string;
  TargetUnitId?: number;
  TargetRoleId?: number;
  TargetGroupId?: number;
}

export interface SendChatMessageInput {
  ClientMessageId: string;
  Body: string;
  MessageType: number;
  Priority: number;
  AsUnitId?: number;
  AsIncidentCommander?: boolean;
  ThreadRootMessageId?: string;
  AlsoSendToChannel?: boolean;
  MetadataJson?: string;
  Mentions?: ChatMentionInput[];
}

export interface EditMessageInput {
  Body: string;
}

export interface AddReactionInput {
  Emoji: string;
}

export interface MarkReadInput {
  Seq: number;
  AsUnitId?: number;
}

export interface FlagMessageInput {
  Reason: number;
  Note?: string;
}
