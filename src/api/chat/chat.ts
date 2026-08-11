import { getBaseApiUrl } from '@/lib/storage/app';
import {
  type AddMembersInput,
  type AddReactionInput,
  type ChatAckResultData,
  type ChatActionResult,
  type ChatAttachmentUploadedResult,
  type ChatChannelResultData,
  type ChatMemberResultData,
  type ChatMessageResultData,
  type ChatV4Response,
  type CreateAdHocChannelInput,
  type CreateDirectMessageInput,
  type EditMessageInput,
  type FlagMessageInput,
  type GetChatPresenceResult,
  type GifResultData,
  type MarkReadInput,
  type SendChatMessageInput,
  type SetNotificationPreferenceInput,
  type UpdateChannelInput,
} from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';

import { api } from '../common/client';

const CHAT = '/Chat';
const MODERATION = '/ChatModeration';

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/**
 * The caller's channels. `includeArchived` pulls in the point-in-time record of closed incidents and
 * calls — off by default so the everyday list stays current.
 */
export const getChannels = async (activeUnitId?: number, includeArchived = false, signal?: AbortSignal) => {
  const params: Record<string, unknown> = {};
  if (activeUnitId != null) {
    params.activeUnitId = activeUnitId;
  }
  if (includeArchived) {
    params.includeArchived = true;
  }

  const response = await api.get<ChatV4Response<ChatChannelResultData[]>>(`${CHAT}/GetChannels`, {
    params: Object.keys(params).length > 0 ? params : undefined,
    signal,
  });
  return response.data;
};

export const getChannel = async (channelId: string, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatChannelResultData>>(`${CHAT}/GetChannel`, { params: { channelId }, signal });
  return response.data;
};

export const createDirectMessage = async (input: CreateDirectMessageInput) => {
  const response = await api.post<ChatV4Response<ChatChannelResultData>>(`${CHAT}/CreateDirectMessage`, input);
  return response.data;
};

export const createAdHocChannel = async (input: CreateAdHocChannelInput) => {
  const response = await api.post<ChatV4Response<ChatChannelResultData>>(`${CHAT}/CreateAdHocChannel`, input);
  return response.data;
};

export const updateChannel = async (channelId: string, input: UpdateChannelInput) => {
  const response = await api.put<ChatV4Response<ChatChannelResultData>>(`${CHAT}/UpdateChannel`, input, { params: { channelId } });
  return response.data;
};

export const archiveChannel = async (channelId: string) => {
  const response = await api.delete<ChatActionResult>(`${CHAT}/ArchiveChannel`, { params: { channelId } });
  return response.data;
};

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const getMembers = async (channelId: string, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMemberResultData[]>>(`${CHAT}/GetMembers`, { params: { channelId }, signal });
  return response.data;
};

export const addMembers = async (channelId: string, input: AddMembersInput) => {
  const response = await api.post<ChatV4Response<ChatMemberResultData[]>>(`${CHAT}/AddMembers`, input, { params: { channelId } });
  return response.data;
};

export const removeMember = async (channelId: string, userId: string) => {
  const response = await api.delete<ChatActionResult>(`${CHAT}/RemoveMember`, { params: { channelId, userId } });
  return response.data;
};

export const setNotificationPreference = async (channelId: string, input: SetNotificationPreferenceInput) => {
  const response = await api.put<ChatActionResult>(`${CHAT}/SetNotificationPreference`, input, { params: { channelId } });
  return response.data;
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const getMessages = async (channelId: string, beforeSeq?: number, limit = 50, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMessageResultData[]>>(`${CHAT}/GetMessages`, {
    params: { channelId, beforeSeq, limit },
    signal,
  });
  return response.data;
};

export const getMessagesAfter = async (channelId: string, afterSeq: number, limit = 50, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMessageResultData[]>>(`${CHAT}/GetMessagesAfter`, {
    params: { channelId, afterSeq, limit },
    signal,
  });
  return response.data;
};

export const getThread = async (messageId: string, beforeSeq?: number, limit = 50, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMessageResultData[]>>(`${CHAT}/GetThread`, {
    params: { messageId, beforeSeq, limit },
    signal,
  });
  return response.data;
};

export const sendMessage = async (channelId: string, input: SendChatMessageInput) => {
  const response = await api.post<ChatV4Response<ChatMessageResultData>>(`${CHAT}/SendMessage`, input, { params: { channelId } });
  return response.data;
};

export const editMessage = async (messageId: string, input: EditMessageInput) => {
  const response = await api.put<ChatV4Response<ChatMessageResultData>>(`${CHAT}/EditMessage`, input, { params: { messageId } });
  return response.data;
};

export const deleteMessage = async (messageId: string) => {
  const response = await api.delete<ChatActionResult>(`${CHAT}/DeleteMessage`, { params: { messageId } });
  return response.data;
};

// ---------------------------------------------------------------------------
// Reactions, acks, read pointers, pins
// ---------------------------------------------------------------------------

export const addReaction = async (messageId: string, input: AddReactionInput) => {
  const response = await api.post<ChatActionResult>(`${CHAT}/AddReaction`, input, { params: { messageId } });
  return response.data;
};

export const removeReaction = async (messageId: string, emoji: string) => {
  const response = await api.delete<ChatActionResult>(`${CHAT}/RemoveReaction`, { params: { messageId, emoji } });
  return response.data;
};

export const ackMessage = async (messageId: string) => {
  const response = await api.post<ChatActionResult>(`${CHAT}/Ack`, {}, { params: { messageId } });
  return response.data;
};

export const getMyPendingAcks = async (signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatAckResultData[]>>(`${CHAT}/GetMyPendingAcks`, { signal });
  return response.data;
};

export const markRead = async (channelId: string, input: MarkReadInput) => {
  const response = await api.put<ChatActionResult>(`${CHAT}/MarkRead`, input, { params: { channelId } });
  return response.data;
};

export const pinMessage = async (messageId: string) => {
  const response = await api.post<ChatActionResult>(`${CHAT}/PinMessage`, {}, { params: { messageId } });
  return response.data;
};

export const unpinMessage = async (messageId: string) => {
  const response = await api.delete<ChatActionResult>(`${CHAT}/UnpinMessage`, { params: { messageId } });
  return response.data;
};

export const getPins = async (channelId: string, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMessageResultData[]>>(`${CHAT}/GetPins`, { params: { channelId }, signal });
  return response.data;
};

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface ChatUploadFile {
  uri: string;
  name: string;
  type: string;
}

export const uploadAttachment = async (channelId: string, messageId: string, file: ChatUploadFile) => {
  const form = new FormData();
  // React Native FormData accepts { uri, name, type } file objects.
  form.append('file', file as unknown as Blob);

  const response = await api.post<ChatAttachmentUploadedResult>(`${CHAT}/UploadAttachment`, form, {
    params: { channelId, messageId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/** Absolute URL for downloading an attachment's binary. */
export const getChatAttachmentUrl = (attachmentId: string): string => `${getBaseApiUrl()}${CHAT}/GetAttachment?attachmentId=${encodeURIComponent(attachmentId)}`;

/** Absolute URL for downloading an attachment's thumbnail. */
export const getChatAttachmentThumbnailUrl = (attachmentId: string): string => `${getBaseApiUrl()}${CHAT}/GetAttachmentThumbnail?attachmentId=${encodeURIComponent(attachmentId)}`;

/**
 * Image source (with bearer auth header) suitable for expo-image / RN Image
 * when rendering a chat attachment.
 */
export const getChatAttachmentImageSource = (attachmentId: string) => {
  const token = useAuthStore.getState().accessToken;
  return {
    uri: getChatAttachmentUrl(attachmentId),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
};

// ---------------------------------------------------------------------------
// Search, GIFs, presence, flags, moderation
// ---------------------------------------------------------------------------

export const searchMessages = async (q: string, channelId?: string, page = 0, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<ChatMessageResultData[]>>(`${CHAT}/Search`, {
    params: { q, channelId, page },
    signal,
  });
  return response.data;
};

export const searchGifs = async (q?: string, limit = 25, offset = 0, signal?: AbortSignal) => {
  const response = await api.get<ChatV4Response<GifResultData[]>>(`${CHAT}/SearchGifs`, {
    params: { q, limit, offset },
    signal,
  });
  return response.data;
};

export const getPresence = async (userIds: string[], signal?: AbortSignal) => {
  const response = await api.get<GetChatPresenceResult>(`${CHAT}/GetPresence`, {
    params: { userIds: userIds.join(',') },
    signal,
  });
  return response.data;
};

export const flagMessage = async (messageId: string, input: FlagMessageInput) => {
  const response = await api.post<ChatActionResult>(`${CHAT}/FlagMessage`, input, { params: { messageId } });
  return response.data;
};

/** Department-admin / moderator hard delete of a message. */
export const moderatorDeleteMessage = async (messageId: string, reason: string) => {
  const response = await api.post<ChatActionResult>(`${MODERATION}/DeleteMessage`, {}, { params: { messageId, reason } });
  return response.data;
};
