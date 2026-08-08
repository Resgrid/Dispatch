import { type Href, Redirect, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { getThread } from '@/api/chat/chat';
import { MessageBubble } from '@/components/chat/message-bubble';
import { MessageComposer } from '@/components/chat/message-composer';
import { Box } from '@/components/ui/box';
import { Divider } from '@/components/ui/divider';
import { FlatList } from '@/components/ui/flat-list';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { ChatMessagePriority, type ChatMessageResultData, ChatMessageType } from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';
import { useChatStore } from '@/stores/chat/store';
import { useChatSystemStatus } from '@/stores/feature-flags/store';

export default function ThreadScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ messageId: string; channelId: string }>();
  const messageId = Array.isArray(params.messageId) ? params.messageId[0] : params.messageId;
  const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

  const chatStatus = useChatSystemStatus();
  const isChatEnabled = chatStatus === 'enabled';
  const currentUserId = useAuthStore((s) => s.userId);
  const channelMessages = useChatStore((s) => (channelId ? s.messagesByChannel[channelId] : undefined));
  const [fetchedReplies, setFetchedReplies] = useState<ChatMessageResultData[]>([]);

  const root = useMemo(() => (channelMessages ?? []).find((m) => m.ChatMessageId === messageId), [channelMessages, messageId]);

  useEffect(() => {
    if (!messageId || !isChatEnabled) return;
    getThread(messageId, undefined, 50)
      .then((response) => setFetchedReplies(response.Data ?? []))
      .catch((error) => logger.error({ message: 'chat: failed to load thread', context: { error, messageId } }));
  }, [messageId, isChatEnabled]);

  // Merge fetched replies with any realtime/optimistic replies already in the channel cache.
  const replies = useMemo(() => {
    const map = new Map<string, ChatMessageResultData>();
    for (const m of fetchedReplies) map.set(m.ChatMessageId, m);
    for (const m of channelMessages ?? []) {
      if (m.ThreadRootMessageId === messageId) {
        const existing = map.get(m.ChatMessageId);
        map.set(m.ChatMessageId, existing ? { ...existing, ...m } : m);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.MessageSeq - b.MessageSeq);
  }, [fetchedReplies, channelMessages, messageId]);

  const inverted = useMemo(() => replies.slice().reverse(), [replies]);

  const handleSendText = useCallback(
    (body: string, urgent: boolean) => {
      if (!channelId || !messageId) return;
      void useChatStore.getState().sendMessage({ channelId, body, threadRootMessageId: messageId, priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal });
    },
    [channelId, messageId]
  );

  const handleSendGif = useCallback(() => {
    // GIFs in threads are sent as text-less messages via the composer's gif flow; kept minimal here.
  }, []);

  const handleSendLocation = useCallback(
    (latitude: number, longitude: number, urgent: boolean) => {
      if (!channelId || !messageId) return;
      void useChatStore.getState().sendMessage({
        channelId,
        body: t('chat.shared_location'),
        messageType: ChatMessageType.Location,
        metadataJson: JSON.stringify({ Latitude: latitude, Longitude: longitude }),
        threadRootMessageId: messageId,
        priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal,
      });
    },
    [channelId, messageId, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageResultData }) => (
      <MessageBubble
        message={item}
        isOwn={!!item.SenderUserId && item.SenderUserId === currentUserId}
        showSender
        currentUserId={currentUserId}
        onLongPress={() => undefined}
        onToggleReaction={(m, emoji, mine) => {
          if (!channelId) return;
          if (mine) void useChatStore.getState().removeReaction(m.ChatMessageId, channelId, emoji);
          else void useChatStore.getState().addReaction(m.ChatMessageId, channelId, emoji);
        }}
      />
    ),
    [currentUserId, channelId]
  );

  // Chat.System flag not yet resolved: wait instead of redirecting away from a valid deep link.
  if (chatStatus === 'unknown') {
    return (
      <Box className="size-full flex-1 items-center justify-center bg-background-0">
        <Stack.Screen options={{ title: t('chat.thread'), headerShown: true, headerBackTitle: '' }} />
        <Spinner />
      </Box>
    );
  }

  // Chat.System feature flag off: block deep links into threads.
  if (chatStatus === 'disabled') {
    return <Redirect href={'/home' as Href} />;
  }

  return (
    <Box className="size-full flex-1 bg-background-0">
      <Stack.Screen options={{ title: t('chat.thread'), headerShown: true, headerBackTitle: '' }} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {root ? (
          <VStack className="border-b border-outline-200 bg-background-50 py-2">
            <Text className="px-4 text-xs font-semibold uppercase text-typography-400">{t('chat.original_message')}</Text>
            <MessageBubble message={root} isOwn={!!root.SenderUserId && root.SenderUserId === currentUserId} showSender currentUserId={currentUserId} onLongPress={() => undefined} onToggleReaction={() => undefined} />
          </VStack>
        ) : null}

        <Divider />

        <FlatList data={inverted} inverted keyExtractor={(item: ChatMessageResultData) => item.ChatMessageId} renderItem={renderItem} contentContainerStyle={{ paddingVertical: 8 }} />

        <MessageComposer onSendText={handleSendText} onSendImage={() => undefined} onSendLocation={handleSendLocation} onOpenGif={handleSendGif} onTyping={() => undefined} placeholder={t('chat.reply_placeholder')} allowUrgent={false} />
      </KeyboardAvoidingView>
    </Box>
  );
}
