import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as chatApi from '@/api/chat/chat';
import * as chatbotApi from '@/api/chat/chatbot';
import { Env } from '@/lib/env';
import { translate } from '@/lib/i18n/utils';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { uuidv4 } from '@/lib/utils';
import {
  type ChatAckResultData,
  type ChatChannelResultData,
  type ChatMemberResultData,
  type ChatMentionInput,
  ChatMessagePriority,
  type ChatMessageResultData,
  ChatMessageType,
  type ChatOutboxItem,
  type ChatReactionResultData,
} from '@/models/v4/chat';
import { signalRService } from '@/services/signalr.service';
import useAuthStore from '@/stores/auth/store';
import { useToastStore } from '@/stores/toast/store';

/** Messages at or above this sequence are optimistic (unconfirmed) sends. */
const PENDING_SEQ_BASE = 9_000_000_000_000;
const TYPING_EXPIRY_MS = 5000;
const TYPING_THROTTLE_MS = 3000;

const getTranslatedMessage = (key: Parameters<typeof translate>[0], fallback: string) => {
  const message = translate(key);
  return typeof message === 'string' && message.length > 0 && message !== key ? message : fallback;
};

export interface ChatTypingUser {
  userId: string;
  displayName?: string;
  expiresAt: number;
}

interface SendMessageArgs {
  channelId: string;
  body: string;
  messageType?: number;
  priority?: number;
  asUnitId?: number;
  asIncidentCommander?: boolean;
  threadRootMessageId?: string;
  alsoSendToChannel?: boolean;
  metadataJson?: string;
  mentions?: ChatMentionInput[];
  localAttachmentUri?: string;
}

interface ChatState {
  channels: ChatChannelResultData[];
  messagesByChannel: Record<string, ChatMessageResultData[]>;
  membersByChannel: Record<string, ChatMemberResultData[]>;
  typingByChannel: Record<string, ChatTypingUser[]>;
  presence: Set<string>;
  pendingAcks: ChatAckResultData[];
  activeChannelId: string | null;
  chatbotChannelId: string | null;
  chatbotTyping: boolean;

  hasMoreByChannel: Record<string, boolean>;
  isLoadingChannels: boolean;
  loadingMessagesByChannel: Record<string, boolean>;

  /** Persisted queue of unsent messages (idempotent resend keyed by ClientMessageId). */
  outbox: ChatOutboxItem[];

  // --- Channels ---------------------------------------------------------
  fetchChannels: (activeUnitId?: number) => Promise<void>;
  /**
   * Chat channels anchored to one incident, kept out of the main channel list so a dispatcher's list
   * isn't buried under every incident's channels. Includes archived ones: a closed incident's
   * conversations stay readable as a point-in-time record.
   */
  incidentChannelsByCallId: Record<string, ChatChannelResultData[]>;
  loadIncidentChannels: (callId: string) => Promise<void>;
  setActiveChannel: (channelId: string | null) => void;

  // --- Messages ---------------------------------------------------------
  loadInitialMessages: (channelId: string) => Promise<void>;
  loadOlderMessages: (channelId: string) => Promise<void>;
  loadNewerMessages: (channelId: string) => Promise<void>;
  sendMessage: (args: SendMessageArgs) => Promise<void>;
  retryOutboxItem: (clientMessageId: string) => Promise<void>;
  drainOutbox: () => Promise<void>;
  editMessage: (messageId: string, channelId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string, channelId: string) => Promise<void>;
  moderatorDeleteMessage: (messageId: string, channelId: string, reason: string) => Promise<void>;

  // --- Reactions / acks / read / pins / flags ---------------------------
  addReaction: (messageId: string, channelId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, channelId: string, emoji: string) => Promise<void>;
  acknowledgeMessage: (messageId: string) => Promise<void>;
  fetchPendingAcks: () => Promise<void>;
  markChannelRead: (channelId: string) => Promise<void>;
  togglePin: (messageId: string, channelId: string, pinned: boolean) => Promise<void>;
  flagMessage: (messageId: string, reason: number, note?: string) => Promise<void>;
  fetchMembers: (channelId: string) => Promise<void>;

  // --- Chatbot (assistant) ---------------------------------------------
  initChatbot: () => Promise<void>;
  sendChatbotMessage: (text: string) => Promise<void>;
  newChatbotSession: () => Promise<void>;

  // --- Realtime send helpers (SignalR invokes) --------------------------
  joinChannel: (channelId: string) => Promise<void>;
  sendTyping: (channelId: string, isTyping: boolean) => void;

  // --- SignalR event handlers (called from the signalr store) -----------
  handleMessageReceived: (raw: unknown) => void;
  handleMessageEdited: (raw: unknown) => void;
  handleMessageDeleted: (raw: unknown) => void;
  handleReactionUpdated: (raw: unknown) => void;
  handleReceiptUpdated: (raw: unknown) => void;
  handleChannelUpdated: (raw: unknown) => void;
  handleChannelProvisioned: (raw: unknown) => void;
  handleModerationApplied: (raw: unknown) => void;
  handleAckRequired: (raw: unknown) => void;
  handleThreadUpdated: (raw: unknown) => void;
  handleChatbotMessageReceived: (raw: unknown) => void;
  handleChatbotTyping: (raw: unknown) => void;
  handleTyping: (raw: unknown) => void;
  handlePresenceChanged: (raw: unknown, isOnlineArg?: unknown) => void;
  handleChatConnected: () => void;

  reset: () => void;
}

// ---------------------------------------------------------------------------
// Module-scope helpers
// ---------------------------------------------------------------------------

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastTypingSentAt = new Map<string, number>();
const lastMarkedSeq = new Map<string, number>();
const pendingChatbotMessages = new Map<string, { channelId: string; text: string }>();
const CHATBOT_TYPING_TIMEOUT_MS = 30_000;
let chatbotTypingTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_OUTBOX_ATTEMPTS = 5;
const OUTBOX_RETRY_BASE_DELAY_MS = 2000;
const OUTBOX_RETRY_MAX_DELAY_MS = 60_000;
let isDrainingOutbox = false;
let outboxDrainTimer: ReturnType<typeof setTimeout> | null = null;

function currentUserId(): string | null {
  return useAuthStore.getState().userId;
}

/** Name broadcast with typing signals; the hub echoes it to the other participants. */
function currentDisplayName(): string | null {
  return useAuthStore.getState().profile?.name ?? null;
}

function parseEventData<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn({ message: 'chat: failed to parse event JSON', context: { error } });
      return null;
    }
  }
  if (typeof raw === 'object') return raw as T;
  return null;
}

function isPending(message: ChatMessageResultData): boolean {
  return message.MessageSeq >= PENDING_SEQ_BASE;
}

function compareMessages(a: ChatMessageResultData, b: ChatMessageResultData): number {
  if (a.MessageSeq !== b.MessageSeq) return a.MessageSeq - b.MessageSeq;
  return new Date(a.SentOn).getTime() - new Date(b.SentOn).getTime();
}

/** The realtime payloads omit empty collections even though the DTO types them as
 * required, so every stored message is normalized on the way in — the UI iterates
 * Reactions/Attachments directly. An existing value always wins over a missing one
 * so a partial hub update can never drop reactions already on screen. */
function withCollections(incoming: ChatMessageResultData, existing?: ChatMessageResultData): ChatMessageResultData {
  return {
    ...incoming,
    Reactions: incoming.Reactions ?? existing?.Reactions ?? [],
    Attachments: incoming.Attachments ?? existing?.Attachments ?? [],
  };
}

/** Insert or replace a message in an ascending-by-sequence list, de-duplicated
 * by ChatMessageId and ClientMessageId (so optimistic sends reconcile). */
function upsertMessage(list: ChatMessageResultData[], incoming: ChatMessageResultData): ChatMessageResultData[] {
  const next = list.slice();
  const idx = next.findIndex((m) => m.ChatMessageId === incoming.ChatMessageId || (!!incoming.ClientMessageId && !!m.ClientMessageId && m.ClientMessageId === incoming.ClientMessageId));
  if (idx >= 0) {
    const existing = next[idx];
    next[idx] = withCollections({ ...existing, ...incoming }, existing);
  } else {
    next.push(withCollections(incoming));
  }
  next.sort(compareMessages);
  return next;
}

function highestRealSeq(list: ChatMessageResultData[] | undefined): number {
  if (!list || list.length === 0) return 0;
  let max = 0;
  for (const m of list) {
    if (!isPending(m) && m.MessageSeq > max) max = m.MessageSeq;
  }
  return max;
}

function lowestRealSeq(list: ChatMessageResultData[] | undefined): number | undefined {
  if (!list || list.length === 0) return undefined;
  let min: number | undefined;
  for (const m of list) {
    if (!isPending(m) && (min === undefined || m.MessageSeq < min)) min = m.MessageSeq;
  }
  return min;
}

async function safeInvoke(method: string, ...args: unknown[]): Promise<void> {
  try {
    await signalRService.invoke(Env.CHAT_HUB_NAME, method, ...args);
  } catch (error) {
    logger.debug({ message: `chat: invoke ${method} skipped`, context: { error } });
  }
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      channels: [],
      messagesByChannel: {},
      membersByChannel: {},
      typingByChannel: {},
      presence: new Set<string>(),
      pendingAcks: [],
      activeChannelId: null,
      chatbotChannelId: null,
      chatbotTyping: false,
      hasMoreByChannel: {},
      isLoadingChannels: false,
      loadingMessagesByChannel: {},
      outbox: [],

      // ------------------------------------------------------------------
      // Channels
      // ------------------------------------------------------------------
      incidentChannelsByCallId: {},

      loadIncidentChannels: async (callId: string) => {
        const numericCallId = parseInt(callId, 10);
        if (Number.isNaN(numericCallId)) {
          return;
        }

        try {
          // callId narrows the list server-side; the local filter stays as a safety net
          // because older servers ignore the param and return every channel.
          const response = await chatApi.getChannels(undefined, true, numericCallId);
          const forCall = (response.Data ?? []).filter((channel) => channel.CallId === numericCallId);
          set((state) => ({ incidentChannelsByCallId: { ...state.incidentChannelsByCallId, [callId]: forCall } }));
        } catch (error) {
          logger.error({ message: 'chat: failed to load incident channels', context: { error, callId } });
        }
      },

      fetchChannels: async (activeUnitId?: number) => {
        set({ isLoadingChannels: true });
        try {
          const response = await chatApi.getChannels(activeUnitId);
          set({ channels: response.Data ?? [], isLoadingChannels: false });
        } catch (error) {
          logger.error({ message: 'chat: failed to fetch channels', context: { error } });
          set({ isLoadingChannels: false });
        }
      },

      setActiveChannel: (channelId: string | null) => {
        set({ activeChannelId: channelId });
      },

      // ------------------------------------------------------------------
      // Messages
      // ------------------------------------------------------------------
      loadInitialMessages: async (channelId: string) => {
        set((state) => ({ loadingMessagesByChannel: { ...state.loadingMessagesByChannel, [channelId]: true } }));
        try {
          const response = await chatApi.getMessages(channelId, undefined, 50);
          const incoming = response.Data ?? [];
          set((state) => {
            let list = state.messagesByChannel[channelId] ?? [];
            for (const m of incoming) list = upsertMessage(list, { ...m, _localStatus: 'sent' });
            return {
              messagesByChannel: { ...state.messagesByChannel, [channelId]: list },
              hasMoreByChannel: { ...state.hasMoreByChannel, [channelId]: incoming.length >= 50 },
              loadingMessagesByChannel: { ...state.loadingMessagesByChannel, [channelId]: false },
            };
          });
        } catch (error) {
          logger.error({ message: 'chat: failed to load messages', context: { error, channelId } });
          set((state) => ({ loadingMessagesByChannel: { ...state.loadingMessagesByChannel, [channelId]: false } }));
        }
      },

      loadOlderMessages: async (channelId: string) => {
        const state = get();
        if (state.loadingMessagesByChannel[channelId]) return;
        if (state.hasMoreByChannel[channelId] === false) return;
        const before = lowestRealSeq(state.messagesByChannel[channelId]);
        if (before === undefined) {
          await get().loadInitialMessages(channelId);
          return;
        }
        set((s) => ({ loadingMessagesByChannel: { ...s.loadingMessagesByChannel, [channelId]: true } }));
        try {
          const response = await chatApi.getMessages(channelId, before, 50);
          const incoming = response.Data ?? [];
          set((s) => {
            let list = s.messagesByChannel[channelId] ?? [];
            for (const m of incoming) list = upsertMessage(list, { ...m, _localStatus: 'sent' });
            return {
              messagesByChannel: { ...s.messagesByChannel, [channelId]: list },
              hasMoreByChannel: { ...s.hasMoreByChannel, [channelId]: incoming.length >= 50 },
              loadingMessagesByChannel: { ...s.loadingMessagesByChannel, [channelId]: false },
            };
          });
        } catch (error) {
          logger.error({ message: 'chat: failed to load older messages', context: { error, channelId } });
          set((s) => ({ loadingMessagesByChannel: { ...s.loadingMessagesByChannel, [channelId]: false } }));
        }
      },

      loadNewerMessages: async (channelId: string) => {
        try {
          let after = highestRealSeq(get().messagesByChannel[channelId]);
          for (;;) {
            const response = await chatApi.getMessagesAfter(channelId, after, 200);
            const incoming = response.Data ?? [];
            if (incoming.length === 0) return;
            set((s) => {
              let list = s.messagesByChannel[channelId] ?? [];
              for (const m of incoming) list = upsertMessage(list, { ...m, _localStatus: 'sent' });
              return { messagesByChannel: { ...s.messagesByChannel, [channelId]: list } };
            });
            if (incoming.length < 200) return;
            after = highestRealSeq(get().messagesByChannel[channelId]);
          }
        } catch (error) {
          logger.error({ message: 'chat: delta sync failed', context: { error, channelId } });
        }
      },

      sendMessage: async (args: SendMessageArgs) => {
        const clientMessageId = uuidv4();
        const now = new Date().toISOString();
        const userId = currentUserId();

        const outboxItem: ChatOutboxItem = {
          ClientMessageId: clientMessageId,
          ChannelId: args.channelId,
          Body: args.body,
          MessageType: args.messageType ?? ChatMessageType.Text,
          Priority: args.priority ?? ChatMessagePriority.Normal,
          AsUnitId: args.asUnitId,
          AsIncidentCommander: args.asIncidentCommander,
          ThreadRootMessageId: args.threadRootMessageId,
          AlsoSendToChannel: args.alsoSendToChannel,
          MetadataJson: args.metadataJson,
          Mentions: args.mentions,
          SenderUserId: userId ?? undefined,
          CreatedAt: Date.now(),
        };

        const optimistic: ChatMessageResultData = {
          ChatMessageId: `local-${clientMessageId}`,
          ChatChannelId: args.channelId,
          MessageSeq: PENDING_SEQ_BASE + outboxItem.CreatedAt,
          SenderParticipantType: 0,
          SenderUserId: userId ?? undefined,
          SenderDisplayName: '',
          Body: args.body,
          MessageType: outboxItem.MessageType,
          Priority: outboxItem.Priority,
          ThreadRootMessageId: args.threadRootMessageId ?? null,
          ThreadReplyCount: 0,
          AlsoSendToChannel: args.alsoSendToChannel ?? false,
          MetadataJson: args.metadataJson ?? null,
          ClientMessageId: clientMessageId,
          SentOn: now,
          Reactions: [],
          Attachments: [],
          _localStatus: 'pending',
          _localAttachmentUri: args.localAttachmentUri,
        };

        set((state) => ({
          outbox: [...state.outbox, outboxItem],
          messagesByChannel: { ...state.messagesByChannel, [args.channelId]: upsertMessage(state.messagesByChannel[args.channelId] ?? [], optimistic) },
        }));

        await sendOutboxItem(outboxItem, set, get);
      },

      retryOutboxItem: async (clientMessageId: string) => {
        const item = get().outbox.find((o) => o.ClientMessageId === clientMessageId);
        if (item) {
          await sendOutboxItem(item, set, get);
          return;
        }
        const pending = pendingChatbotMessages.get(clientMessageId);
        if (!pending) return;
        set({ chatbotTyping: true });
        startChatbotTypingTimeout(set);
        try {
          await chatbotApi.sendChatbotMessage(pending.text, clientMessageId);
          pendingChatbotMessages.delete(clientMessageId);
          patchMessage(set, pending.channelId, `local-${clientMessageId}`, { _localStatus: 'sent' });
        } catch (error) {
          logger.error({ message: 'chat: chatbot resend failed', context: { error } });
          markOutboxFailed(set, pending.channelId, clientMessageId);
          clearChatbotTypingTimeout();
          set({ chatbotTyping: false });
        }
      },

      drainOutbox: async () => {
        if (isDrainingOutbox) return;
        isDrainingOutbox = true;
        try {
          const userId = currentUserId();
          const now = Date.now();
          let nextEligibleIn: number | null = null;
          for (const item of [...get().outbox]) {
            if (item.SenderUserId && item.SenderUserId !== userId) continue;
            const attempts = item.Attempts ?? 0;
            if (attempts >= MAX_OUTBOX_ATTEMPTS) continue;
            const delay = outboxRetryDelayMs(attempts);
            const elapsed = now - (item.LastAttemptAt ?? 0);
            if (attempts > 0 && elapsed < delay) {
              nextEligibleIn = Math.min(nextEligibleIn ?? Number.MAX_SAFE_INTEGER, delay - elapsed);
              continue;
            }
            await sendOutboxItem(item, set, get);
            const failed = get().outbox.find((outboxItem) => outboxItem.ClientMessageId === item.ClientMessageId);
            if (failed) {
              const retryDelay = outboxRetryDelayMs(failed.Attempts ?? 1);
              const elapsed = Date.now() - (failed.LastAttemptAt ?? 0);
              nextEligibleIn = Math.min(nextEligibleIn ?? Number.MAX_SAFE_INTEGER, Math.max(0, retryDelay - elapsed));
            }
          }
          if (nextEligibleIn !== null && get().outbox.some((item) => (item.Attempts ?? 0) < MAX_OUTBOX_ATTEMPTS)) {
            scheduleOutboxDrain(nextEligibleIn);
          }
        } finally {
          isDrainingOutbox = false;
        }
      },

      editMessage: async (messageId: string, channelId: string, body: string) => {
        try {
          const response = await chatApi.editMessage(messageId, { Body: body });
          if (response.Data) {
            set((s) => ({ messagesByChannel: { ...s.messagesByChannel, [channelId]: upsertMessage(s.messagesByChannel[channelId] ?? [], { ...response.Data, _localStatus: 'sent' }) } }));
          }
        } catch (error) {
          logger.error({ message: 'chat: edit failed', context: { error, messageId } });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.edit_failed', 'Could not edit message'));
        }
      },

      deleteMessage: async (messageId: string, channelId: string) => {
        try {
          await chatApi.deleteMessage(messageId);
          patchMessage(set, channelId, messageId, { DeletedOn: new Date().toISOString(), DeletedByUserId: currentUserId() ?? undefined });
        } catch (error) {
          logger.error({ message: 'chat: delete failed', context: { error, messageId } });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.delete_failed', 'Could not delete message'));
        }
      },

      moderatorDeleteMessage: async (messageId: string, channelId: string, reason: string) => {
        try {
          await chatApi.moderatorDeleteMessage(messageId, reason);
          patchMessage(set, channelId, messageId, { DeletedOn: new Date().toISOString() });
        } catch (error) {
          logger.error({ message: 'chat: moderator delete failed', context: { error, messageId } });
        }
      },

      // ------------------------------------------------------------------
      // Reactions / acks / read / pins / flags
      // ------------------------------------------------------------------
      addReaction: async (messageId: string, channelId: string, emoji: string) => {
        const userId = currentUserId();
        const previousReactions = (get().messagesByChannel[channelId] ?? []).find((m) => m.ChatMessageId === messageId)?.Reactions;
        // optimistic
        set((s) => {
          const list = s.messagesByChannel[channelId] ?? [];
          const idx = list.findIndex((m) => m.ChatMessageId === messageId);
          if (idx < 0) return {};
          const msg = list[idx];
          if (msg.Reactions.some((r) => r.Emoji === emoji && r.UserId === userId)) return {};
          const reactions: ChatReactionResultData[] = [...msg.Reactions, { Emoji: emoji, ParticipantType: 0, UserId: userId }];
          const next = list.slice();
          next[idx] = { ...msg, Reactions: reactions };
          return { messagesByChannel: { ...s.messagesByChannel, [channelId]: next } };
        });
        try {
          await chatApi.addReaction(messageId, { Emoji: emoji });
        } catch (error) {
          logger.error({ message: 'chat: add reaction failed', context: { error, messageId } });
          if (previousReactions) patchMessage(set, channelId, messageId, { Reactions: previousReactions });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.reaction_failed', 'Could not update reaction'));
        }
      },

      removeReaction: async (messageId: string, channelId: string, emoji: string) => {
        const userId = currentUserId();
        const previousReactions = (get().messagesByChannel[channelId] ?? []).find((m) => m.ChatMessageId === messageId)?.Reactions;
        set((s) => {
          const list = s.messagesByChannel[channelId] ?? [];
          const idx = list.findIndex((m) => m.ChatMessageId === messageId);
          if (idx < 0) return {};
          const msg = list[idx];
          const reactions = msg.Reactions.filter((r) => !(r.Emoji === emoji && r.UserId === userId));
          const next = list.slice();
          next[idx] = { ...msg, Reactions: reactions };
          return { messagesByChannel: { ...s.messagesByChannel, [channelId]: next } };
        });
        try {
          await chatApi.removeReaction(messageId, emoji);
        } catch (error) {
          logger.error({ message: 'chat: remove reaction failed', context: { error, messageId } });
          if (previousReactions) patchMessage(set, channelId, messageId, { Reactions: previousReactions });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.reaction_failed', 'Could not update reaction'));
        }
      },

      acknowledgeMessage: async (messageId: string) => {
        try {
          await chatApi.ackMessage(messageId);
          set((s) => ({ pendingAcks: s.pendingAcks.filter((a) => a.ChatMessageId !== messageId) }));
        } catch (error) {
          logger.error({ message: 'chat: ack failed', context: { error, messageId } });
        }
      },

      fetchPendingAcks: async () => {
        try {
          const response = await chatApi.getMyPendingAcks();
          set({ pendingAcks: response.Data ?? [] });
        } catch (error) {
          logger.debug({ message: 'chat: fetch pending acks failed', context: { error } });
        }
      },

      markChannelRead: async (channelId: string) => {
        const seq = highestRealSeq(get().messagesByChannel[channelId]);
        if (seq <= 0) return;
        if ((lastMarkedSeq.get(channelId) ?? 0) >= seq) return;
        lastMarkedSeq.set(channelId, seq);

        set((s) => ({
          channels: s.channels.map((c) => (c.ChatChannelId === channelId ? { ...c, UnreadCount: 0, MyLastReadSeq: seq } : c)),
        }));

        // Hub signature: MarkRead(channelId, seq, asUnitId).
        void safeInvoke('MarkRead', channelId, seq, null);
        try {
          await chatApi.markRead(channelId, { Seq: seq });
        } catch (error) {
          logger.debug({ message: 'chat: markRead failed', context: { error, channelId } });
          if (lastMarkedSeq.get(channelId) === seq) {
            lastMarkedSeq.delete(channelId);
          }
        }
      },

      togglePin: async (messageId: string, channelId: string, pinned: boolean) => {
        try {
          if (pinned) await chatApi.pinMessage(messageId);
          else await chatApi.unpinMessage(messageId);
          patchMessage(set, channelId, messageId, { PinnedOn: pinned ? new Date().toISOString() : null });
        } catch (error) {
          logger.error({ message: 'chat: pin toggle failed', context: { error, messageId } });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.pin_failed', 'Could not update pin'));
        }
      },

      flagMessage: async (messageId: string, reason: number, note?: string) => {
        try {
          await chatApi.flagMessage(messageId, { Reason: reason, Note: note });
        } catch (error) {
          logger.error({ message: 'chat: flag failed', context: { error, messageId } });
          useToastStore.getState().showToast('error', getTranslatedMessage('chat.flag_failed', 'Could not report message'));
        }
      },

      fetchMembers: async (channelId: string) => {
        try {
          const response = await chatApi.getMembers(channelId);
          set((s) => ({ membersByChannel: { ...s.membersByChannel, [channelId]: response.Data ?? [] } }));
        } catch (error) {
          logger.debug({ message: 'chat: fetch members failed', context: { error, channelId } });
        }
      },

      // ------------------------------------------------------------------
      // Chatbot (assistant)
      // ------------------------------------------------------------------
      initChatbot: async () => {
        try {
          const channel = await chatbotApi.getChatbotChannel();
          if (channel?.ChatChannelId) {
            set({ chatbotChannelId: channel.ChatChannelId });
            await get().loadInitialMessages(channel.ChatChannelId);
            void get().joinChannel(channel.ChatChannelId);
          }
        } catch (error) {
          logger.error({ message: 'chat: failed to init chatbot channel', context: { error } });
        }
      },

      sendChatbotMessage: async (text: string) => {
        const channelId = get().chatbotChannelId;
        if (!channelId) return;
        const clientMessageId = uuidv4();
        const now = new Date().toISOString();
        const userId = currentUserId();

        const optimistic: ChatMessageResultData = {
          ChatMessageId: `local-${clientMessageId}`,
          ChatChannelId: channelId,
          MessageSeq: PENDING_SEQ_BASE + Date.now(),
          SenderParticipantType: 0,
          SenderUserId: userId ?? undefined,
          SenderDisplayName: '',
          Body: text,
          MessageType: ChatMessageType.Text,
          Priority: ChatMessagePriority.Normal,
          ThreadRootMessageId: null,
          ThreadReplyCount: 0,
          AlsoSendToChannel: false,
          MetadataJson: null,
          ClientMessageId: clientMessageId,
          SentOn: now,
          Reactions: [],
          Attachments: [],
          _localStatus: 'pending',
        };

        set((s) => ({
          chatbotTyping: true,
          messagesByChannel: { ...s.messagesByChannel, [channelId]: upsertMessage(s.messagesByChannel[channelId] ?? [], optimistic) },
        }));
        pendingChatbotMessages.set(clientMessageId, { channelId, text });
        startChatbotTypingTimeout(set);

        try {
          await chatbotApi.sendChatbotMessage(text, clientMessageId);
          pendingChatbotMessages.delete(clientMessageId);
          patchMessage(set, channelId, optimistic.ChatMessageId, { _localStatus: 'sent' });
        } catch (error) {
          logger.error({ message: 'chat: chatbot send failed', context: { error } });
          markOutboxFailed(set, channelId, clientMessageId);
          clearChatbotTypingTimeout();
          set({ chatbotTyping: false });
        }
      },

      newChatbotSession: async () => {
        try {
          await chatbotApi.newChatbotSession();
        } catch (error) {
          logger.error({ message: 'chat: new chatbot session failed', context: { error } });
        }
      },

      // ------------------------------------------------------------------
      // Realtime send helpers
      // ------------------------------------------------------------------
      joinChannel: async (channelId: string) => {
        // Hub signature: JoinChannel(channelId, asUnitId). SignalR binds hub arguments
        // positionally and rejects an invocation that supplies fewer than the method
        // declares, so omitting the optional argument left the connection outside the
        // channel group and the channel permanently silent.
        await safeInvoke('JoinChannel', channelId, null);
      },

      sendTyping: (channelId: string, isTyping: boolean) => {
        const now = Date.now();
        if (isTyping) {
          const last = lastTypingSentAt.get(channelId) ?? 0;
          if (now - last < TYPING_THROTTLE_MS) return;
          lastTypingSentAt.set(channelId, now);
        } else {
          lastTypingSentAt.delete(channelId);
        }
        // Hub signature: Typing(channelId, displayName, isTyping, asUnitId).
        void safeInvoke('Typing', channelId, currentDisplayName(), isTyping, null);
      },

      // ------------------------------------------------------------------
      // SignalR event handlers
      // ------------------------------------------------------------------
      handleMessageReceived: (raw: unknown) => {
        const msg = parseEventData<ChatMessageResultData>(raw);
        if (!msg || !msg.ChatChannelId) return;
        const state = get();
        const isOwn = !!msg.SenderUserId && msg.SenderUserId === currentUserId();
        const isActive = state.activeChannelId === msg.ChatChannelId;

        set((s) => {
          const list = upsertMessage(s.messagesByChannel[msg.ChatChannelId] ?? [], { ...msg, _localStatus: 'sent' });
          const channels = s.channels.map((c) =>
            c.ChatChannelId === msg.ChatChannelId ? { ...c, LastMessageSeq: Math.max(c.LastMessageSeq, msg.MessageSeq), LastMessageOn: msg.SentOn, UnreadCount: isActive || isOwn ? c.UnreadCount : c.UnreadCount + 1 } : c
          );
          return { messagesByChannel: { ...s.messagesByChannel, [msg.ChatChannelId]: list }, channels };
        });

        // Clear the sender's typing indicator now that a message landed.
        removeTyping(set, msg.ChatChannelId, msg.SenderUserId ?? undefined);
      },

      handleMessageEdited: (raw: unknown) => {
        const msg = parseEventData<ChatMessageResultData>(raw);
        if (!msg || !msg.ChatChannelId) return;
        set((s) => ({ messagesByChannel: { ...s.messagesByChannel, [msg.ChatChannelId]: upsertMessage(s.messagesByChannel[msg.ChatChannelId] ?? [], { ...msg, _localStatus: 'sent' }) } }));
      },

      handleMessageDeleted: (raw: unknown) => {
        const evt = parseEventData<{ ChatMessageId: string; ChatChannelId: string; DeletedOn?: string; DeletedByUserId?: string }>(raw);
        if (!evt || !evt.ChatChannelId || !evt.ChatMessageId) return;
        patchMessage(set, evt.ChatChannelId, evt.ChatMessageId, { DeletedOn: evt.DeletedOn ?? new Date().toISOString(), DeletedByUserId: evt.DeletedByUserId });
      },

      handleReactionUpdated: (raw: unknown) => {
        const evt = parseEventData<{ ChatMessageId: string; ChatChannelId: string; Reactions: ChatReactionResultData[] }>(raw);
        if (!evt || !evt.ChatChannelId || !evt.ChatMessageId) return;
        patchMessage(set, evt.ChatChannelId, evt.ChatMessageId, { Reactions: evt.Reactions ?? [] });
      },

      handleReceiptUpdated: (raw: unknown) => {
        const evt = parseEventData<{ ChatChannelId: string; UserId?: string; Seq: number }>(raw);
        if (!evt || !evt.ChatChannelId) return;
        set((s) => {
          const members = s.membersByChannel[evt.ChatChannelId];
          if (!members) return {};
          const next = members.map((m) => (m.UserId && evt.UserId && m.UserId === evt.UserId ? { ...m, LastReadSeq: Math.max(m.LastReadSeq, evt.Seq) } : m));
          return { membersByChannel: { ...s.membersByChannel, [evt.ChatChannelId]: next } };
        });
      },

      handleChannelUpdated: (raw: unknown) => {
        const channel = parseEventData<ChatChannelResultData>(raw);
        if (!channel || !channel.ChatChannelId) return;
        upsertChannel(set, channel);
      },

      handleChannelProvisioned: (raw: unknown) => {
        const channel = parseEventData<ChatChannelResultData>(raw);
        if (!channel || !channel.ChatChannelId) return;
        upsertChannel(set, channel);
      },

      handleModerationApplied: (raw: unknown) => {
        const evt = parseEventData<{ ChatChannelId: string; ChatMessageId?: string }>(raw);
        if (!evt || !evt.ChatChannelId) return;
        if (evt.ChatMessageId) {
          patchMessage(set, evt.ChatChannelId, evt.ChatMessageId, { DeletedOn: new Date().toISOString() });
        }
      },

      handleAckRequired: (raw: unknown) => {
        const ack = parseEventData<ChatAckResultData & { SenderUserId?: string | null }>(raw);
        if (!ack || !ack.ChatMessageId) return;
        // The sender never has to acknowledge their own urgent message.
        if (ack.SenderUserId && ack.SenderUserId === currentUserId()) return;
        set((s) => (s.pendingAcks.some((a) => a.ChatMessageId === ack.ChatMessageId) ? {} : { pendingAcks: [...s.pendingAcks, ack] }));
      },

      handleThreadUpdated: (raw: unknown) => {
        const evt = parseEventData<{ ChatChannelId: string; ThreadRootMessageId: string; ThreadReplyCount: number; LastThreadReplyOn?: string }>(raw);
        if (!evt || !evt.ChatChannelId || !evt.ThreadRootMessageId) return;
        patchMessage(set, evt.ChatChannelId, evt.ThreadRootMessageId, { ThreadReplyCount: evt.ThreadReplyCount, LastThreadReplyOn: evt.LastThreadReplyOn });
      },

      handleChatbotMessageReceived: (raw: unknown) => {
        const msg = parseEventData<ChatMessageResultData>(raw);
        if (!msg || !msg.ChatChannelId) return;
        clearChatbotTypingTimeout();
        set((s) => ({
          chatbotTyping: false,
          messagesByChannel: { ...s.messagesByChannel, [msg.ChatChannelId]: upsertMessage(s.messagesByChannel[msg.ChatChannelId] ?? [], { ...msg, _localStatus: 'sent' }) },
        }));
      },

      handleChatbotTyping: (raw: unknown) => {
        const evt = parseEventData<{ IsTyping?: boolean; isTyping?: boolean }>(raw);
        const isTyping = evt?.IsTyping ?? evt?.isTyping ?? false;
        set({ chatbotTyping: isTyping });
      },

      handleTyping: (raw: unknown) => {
        // The hub payload uses ChannelId (not ChatChannelId) and its casing depends on the
        // server's JSON naming policy, so accept both spellings of every field.
        const obj = (parseEventData<Record<string, unknown>>(raw) ?? {}) as Record<string, unknown>;
        const channelId = (obj.ChatChannelId ?? obj.chatChannelId ?? obj.ChannelId ?? obj.channelId) as string | undefined;
        const userId = (obj.UserId ?? obj.userId) as string | undefined;
        const displayName = (obj.DisplayName ?? obj.displayName) as string | undefined;
        const isTyping = (obj.IsTyping ?? obj.isTyping) as boolean | undefined;
        if (!channelId || !userId) return;
        if (userId === currentUserId()) return;

        if (isTyping === false) {
          removeTyping(set, channelId, userId);
          return;
        }
        addTyping(set, channelId, { userId, displayName, expiresAt: Date.now() + TYPING_EXPIRY_MS });
      },

      handlePresenceChanged: (raw: unknown, isOnlineArg?: unknown) => {
        // The hub sends `chatPresenceChanged` as two positional args (userId, isOnline);
        // keep the object form working in case a future producer sends a DTO.
        const obj = (typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
        const userId = typeof raw === 'string' ? raw : ((obj.UserId ?? obj.userId) as string | undefined);
        const isOnline = typeof raw === 'string' ? Boolean(isOnlineArg) : ((obj.IsOnline ?? obj.isOnline) as boolean | undefined);
        if (!userId) return;
        set((s) => {
          const presence = new Set(s.presence);
          if (isOnline) presence.add(userId);
          else presence.delete(userId);
          return { presence };
        });
      },

      handleChatConnected: () => {
        const { activeChannelId } = get();
        void get().fetchChannels();
        void get().fetchPendingAcks();
        void get().drainOutbox();
        if (activeChannelId) {
          void get().joinChannel(activeChannelId);
          void get().loadNewerMessages(activeChannelId);
        }
      },

      reset: () => {
        typingTimers.forEach((t) => clearTimeout(t));
        typingTimers.clear();
        lastTypingSentAt.clear();
        lastMarkedSeq.clear();
        pendingChatbotMessages.clear();
        clearChatbotTypingTimeout();
        if (outboxDrainTimer) {
          clearTimeout(outboxDrainTimer);
          outboxDrainTimer = null;
        }
        set({
          channels: [],
          incidentChannelsByCallId: {},
          messagesByChannel: {},
          membersByChannel: {},
          typingByChannel: {},
          presence: new Set<string>(),
          pendingAcks: [],
          activeChannelId: null,
          chatbotChannelId: null,
          chatbotTyping: false,
          hasMoreByChannel: {},
          loadingMessagesByChannel: {},
          outbox: [],
        });
      },
    }),
    {
      name: 'chat-outbox-storage',
      storage: createJSONStorage(() => zustandStorage),
      // Only the outbox is persisted; the message cache lives in memory + react-query.
      partialize: (state) => ({ outbox: state.outbox }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { outbox?: ChatOutboxItem[] } | undefined;
        const outbox = persisted?.outbox ?? [];
        const messagesByChannel = { ...currentState.messagesByChannel };
        for (const item of outbox) {
          messagesByChannel[item.ChannelId] = upsertMessage(messagesByChannel[item.ChannelId] ?? [], buildOutboxOptimisticMessage(item));
        }
        return { ...currentState, outbox, messagesByChannel };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Store-external helpers (need set/get access)
// ---------------------------------------------------------------------------

type SetState = (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void;
type GetState = () => ChatState;

async function sendOutboxItem(item: ChatOutboxItem, set: SetState, get: GetState): Promise<void> {
  try {
    const response = await chatApi.sendMessage(item.ChannelId, {
      ClientMessageId: item.ClientMessageId,
      Body: item.Body,
      MessageType: item.MessageType,
      Priority: item.Priority,
      AsUnitId: item.AsUnitId,
      AsIncidentCommander: item.AsIncidentCommander,
      ThreadRootMessageId: item.ThreadRootMessageId,
      AlsoSendToChannel: item.AlsoSendToChannel,
      MetadataJson: item.MetadataJson,
      Mentions: item.Mentions,
    });

    const server = response.Data;
    if (!server) {
      markOutboxFailed(set, item.ChannelId, item.ClientMessageId);
      return;
    }

    // Reconcile the optimistic bubble with the server row (keep any local image uri).
    set((s) => {
      const list = s.messagesByChannel[item.ChannelId] ?? [];
      const existing = list.find((m) => m.ClientMessageId === item.ClientMessageId);
      const merged: ChatMessageResultData = { ...server, _localStatus: 'sent', _localAttachmentUri: existing?._localAttachmentUri };
      return {
        messagesByChannel: { ...s.messagesByChannel, [item.ChannelId]: upsertMessage(list, merged) },
        outbox: s.outbox.filter((o) => o.ClientMessageId !== item.ClientMessageId),
      };
    });
  } catch (error) {
    logger.warn({ message: 'chat: send failed, kept in outbox', context: { error, clientMessageId: item.ClientMessageId } });
    markOutboxFailed(set, item.ChannelId, item.ClientMessageId, error);
  }
}

function startChatbotTypingTimeout(set: SetState): void {
  clearChatbotTypingTimeout();
  chatbotTypingTimer = setTimeout(() => {
    chatbotTypingTimer = null;
    set({ chatbotTyping: false });
  }, CHATBOT_TYPING_TIMEOUT_MS);
}

function clearChatbotTypingTimeout(): void {
  if (chatbotTypingTimer) {
    clearTimeout(chatbotTypingTimer);
    chatbotTypingTimer = null;
  }
}

function outboxRetryDelayMs(attempts: number): number {
  return Math.min(OUTBOX_RETRY_MAX_DELAY_MS, OUTBOX_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

function isNonRetryableSendError(error: unknown): boolean {
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status;
  if (typeof status !== 'number') return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

function scheduleOutboxDrain(delayMs: number): void {
  if (outboxDrainTimer) clearTimeout(outboxDrainTimer);
  outboxDrainTimer = setTimeout(() => {
    outboxDrainTimer = null;
    void useChatStore.getState().drainOutbox();
  }, delayMs);
}

function buildOutboxOptimisticMessage(item: ChatOutboxItem): ChatMessageResultData {
  return {
    ChatMessageId: `local-${item.ClientMessageId}`,
    ChatChannelId: item.ChannelId,
    MessageSeq: PENDING_SEQ_BASE + item.CreatedAt,
    SenderParticipantType: 0,
    SenderUserId: item.SenderUserId ?? undefined,
    SenderDisplayName: item.SenderDisplayName ?? '',
    Body: item.Body,
    MessageType: item.MessageType,
    Priority: item.Priority,
    ThreadRootMessageId: item.ThreadRootMessageId ?? null,
    ThreadReplyCount: 0,
    AlsoSendToChannel: item.AlsoSendToChannel ?? false,
    MetadataJson: item.MetadataJson ?? null,
    ClientMessageId: item.ClientMessageId,
    SentOn: new Date(item.CreatedAt).toISOString(),
    Reactions: [],
    Attachments: [],
    _localStatus: 'pending',
  };
}

function markOutboxFailed(set: SetState, channelId: string, clientMessageId: string, error?: unknown): void {
  const terminal = isNonRetryableSendError(error);
  set((s) => {
    const list = s.messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ClientMessageId === clientMessageId);
    const next = list.slice();
    if (idx >= 0) next[idx] = { ...next[idx], _localStatus: 'failed' };

    let outbox = s.outbox;
    const itemIdx = s.outbox.findIndex((o) => o.ClientMessageId === clientMessageId);
    if (itemIdx >= 0) {
      const attempts = (s.outbox[itemIdx].Attempts ?? 0) + 1;
      if (terminal || attempts >= MAX_OUTBOX_ATTEMPTS) {
        outbox = s.outbox.filter((o) => o.ClientMessageId !== clientMessageId);
      } else {
        outbox = s.outbox.slice();
        outbox[itemIdx] = { ...outbox[itemIdx], Attempts: attempts, LastAttemptAt: Date.now() };
      }
    }

    return {
      ...(idx >= 0 ? { messagesByChannel: { ...s.messagesByChannel, [channelId]: next } } : {}),
      ...(outbox !== s.outbox ? { outbox } : {}),
    };
  });
}

function patchMessage(set: SetState, channelId: string, messageId: string, patch: Partial<ChatMessageResultData>): void {
  set((s) => {
    const list = s.messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ChatMessageId === messageId);
    if (idx < 0) return {};
    const next = list.slice();
    next[idx] = { ...next[idx], ...patch };
    return { messagesByChannel: { ...s.messagesByChannel, [channelId]: next } };
  });
}

function upsertChannel(set: SetState, channel: ChatChannelResultData): void {
  set((s) => {
    const idx = s.channels.findIndex((c) => c.ChatChannelId === channel.ChatChannelId);
    if (idx < 0) return { channels: [...s.channels, channel] };
    const next = s.channels.slice();
    next[idx] = { ...next[idx], ...channel };
    return { channels: next };
  });
}

function addTyping(set: SetState, channelId: string, user: ChatTypingUser): void {
  const key = `${channelId}:${user.userId}`;
  const existing = typingTimers.get(key);
  if (existing) clearTimeout(existing);
  typingTimers.set(
    key,
    setTimeout(() => {
      typingTimers.delete(key);
      removeTyping(set, channelId, user.userId);
    }, TYPING_EXPIRY_MS)
  );

  set((s) => {
    const current = s.typingByChannel[channelId] ?? [];
    const filtered = current.filter((u) => u.userId !== user.userId);
    return { typingByChannel: { ...s.typingByChannel, [channelId]: [...filtered, user] } };
  });
}

function removeTyping(set: SetState, channelId: string, userId?: string): void {
  if (!userId) return;
  const key = `${channelId}:${userId}`;
  const existing = typingTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    typingTimers.delete(key);
  }
  set((s) => {
    const current = s.typingByChannel[channelId];
    if (!current) return {};
    return { typingByChannel: { ...s.typingByChannel, [channelId]: current.filter((u) => u.userId !== userId) } };
  });
}
