import { Image } from 'expo-image';
import { type Href, Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Circle } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { getPresence, uploadAttachment } from '@/api/chat/chat';
import { AckBanner } from '@/components/chat/ack-banner';
import { copyToClipboard, getChannelDisplayName, getImageMimeType } from '@/components/chat/chat-utils';
import { GifPickerSheet } from '@/components/chat/gif-picker-sheet';
import { MessageActionsSheet } from '@/components/chat/message-actions-sheet';
import { MessageBubble } from '@/components/chat/message-bubble';
import { MessageComposer } from '@/components/chat/message-composer';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { ChatChannelType, ChatMessagePriority, type ChatMessageResultData, ChatMessageType, type GifResultData } from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';
import { useChatStore } from '@/stores/chat/store';
import { useIsChatEnabled } from '@/stores/feature-flags/store';
import { securityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

export default function ChannelConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ channelId: string }>();
  const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

  const currentUserId = useAuthStore((s) => s.userId);
  const isModerator = !!securityStore((s) => s.rights)?.IsAdmin;
  const isChatEnabled = useIsChatEnabled();

  const channel = useChatStore((s) => s.channels.find((c) => c.ChatChannelId === channelId));
  const messages = useChatStore((s) => (channelId ? s.messagesByChannel[channelId] : undefined));
  const typing = useChatStore((s) => (channelId ? s.typingByChannel[channelId] : undefined));
  const members = useChatStore((s) => (channelId ? s.membersByChannel[channelId] : undefined));
  const presence = useChatStore((s) => s.presence);
  const pendingAcks = useChatStore((s) => s.pendingAcks);
  const loading = useChatStore((s) => (channelId ? s.loadingMessagesByChannel[channelId] : false));

  const [gifOpen, setGifOpen] = useState(false);
  const [actionsMessage, setActionsMessage] = useState<ChatMessageResultData | null>(null);
  const [editMessage, setEditMessage] = useState<ChatMessageResultData | null>(null);
  const [editText, setEditText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [presenceIds, setPresenceIds] = useState<Set<string>>(new Set());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isDm = channel?.ChannelType === ChatChannelType.DirectMessage;
  const showSender = !isDm;

  // Newest-first for the inverted list.
  const inverted = useMemo(() => (messages ? messages.slice().reverse() : []), [messages]);

  // Mount: activate channel, join hub, load history and members.
  useFocusEffect(
    useCallback(() => {
      if (!channelId || !isChatEnabled) return;
      const store = useChatStore.getState();
      store.setActiveChannel(channelId);
      void store.joinChannel(channelId);
      void store.loadInitialMessages(channelId);
      void store.fetchMembers(channelId);
      return () => {
        useChatStore.getState().setActiveChannel(null);
      };
    }, [channelId, isChatEnabled])
  );

  // Fetch presence for the channel members (for the header online dot).
  useEffect(() => {
    const ids = (members ?? []).map((m) => m.UserId).filter((id): id is string => !!id && id !== currentUserId);
    if (ids.length === 0) return;
    const controller = new AbortController();
    getPresence(ids, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPresenceIds(new Set(result.OnlineUserIds ?? []));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [members, currentUserId]);

  // Mark read whenever the newest message changes while viewing.
  useEffect(() => {
    if (channelId && inverted.length > 0) {
      void useChatStore.getState().markChannelRead(channelId);
    }
  }, [channelId, inverted.length]);

  const otherOnline = useMemo(() => {
    if (!isDm) return false;
    const other = (members ?? []).find((m) => m.UserId && m.UserId !== currentUserId);
    if (!other?.UserId) return false;
    return presence.has(other.UserId) || presenceIds.has(other.UserId);
  }, [isDm, members, currentUserId, presence, presenceIds]);

  const channelAcks = useMemo(() => pendingAcks.filter((a) => a.ChatChannelId === channelId), [pendingAcks, channelId]);

  useEffect(
    () => () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    },
    [channelId]
  );

  const typingNames = useMemo(() => {
    const now = Date.now();
    return (typing ?? []).filter((u) => u.expiresAt > now).map((u) => u.displayName || t('chat.someone'));
  }, [typing, t]);

  // ---- send handlers ----
  const handleSendText = useCallback(
    (body: string, urgent: boolean) => {
      if (!channelId) return;
      void useChatStore.getState().sendMessage({ channelId, body, priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal });
    },
    [channelId]
  );

  const handleSendGif = useCallback(
    (gif: GifResultData) => {
      if (!channelId) return;
      const metadata = JSON.stringify({ GifUrl: gif.GifUrl, PreviewUrl: gif.PreviewUrl, Width: gif.Width, Height: gif.Height, Title: gif.Title });
      void useChatStore.getState().sendMessage({ channelId, body: gif.Title ?? 'GIF', messageType: ChatMessageType.Gif, metadataJson: metadata });
    },
    [channelId]
  );

  const handleSendLocation = useCallback(
    (latitude: number, longitude: number, urgent: boolean) => {
      if (!channelId) return;
      const metadata = JSON.stringify({ Latitude: latitude, Longitude: longitude });
      void useChatStore.getState().sendMessage({
        channelId,
        body: t('chat.shared_location'),
        messageType: ChatMessageType.Location,
        metadataJson: metadata,
        priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal,
      });
    },
    [channelId, t]
  );

  // Image send: optimistic bubble, then upload the file once the queued message
  // is reconciled and receives its server ChatMessageId (initial send, retry, or outbox drain).
  const handleSendImage = useCallback(
    (uri: string, urgent: boolean, mimeType?: string) => {
      if (!channelId) return;
      const name = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
      const type = getImageMimeType(uri, mimeType);

      const unsubscribe = useChatStore.subscribe((state) => {
        const sent = (state.messagesByChannel[channelId] ?? []).find((m) => m._localAttachmentUri === uri);
        if (!sent) return;
        if (sent._localStatus === 'failed') {
          const retryable = state.outbox.some((item) => item.ClientMessageId === sent.ClientMessageId);
          if (retryable) return;
          unsubscribe();
          if (unsubscribeRef.current === unsubscribe) unsubscribeRef.current = null;
          return;
        }
        if (sent.ChatMessageId.startsWith('local-')) return;
        unsubscribe();
        if (unsubscribeRef.current === unsubscribe) unsubscribeRef.current = null;
        void (async () => {
          try {
            await uploadAttachment(channelId, sent.ChatMessageId, { uri, name, type });
          } catch {
            useToastStore.getState().showToast('error', t('chat.attachment_failed'));
          }
        })();
      });
      unsubscribeRef.current = unsubscribe;

      void useChatStore.getState().sendMessage({
        channelId,
        body: '',
        messageType: ChatMessageType.Image,
        priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal,
        localAttachmentUri: uri,
      });
    },
    [channelId, t]
  );

  const handleToggleReaction = useCallback(
    (message: ChatMessageResultData, emoji: string, mine: boolean) => {
      if (!channelId) return;
      if (mine) void useChatStore.getState().removeReaction(message.ChatMessageId, channelId, emoji);
      else void useChatStore.getState().addReaction(message.ChatMessageId, channelId, emoji);
    },
    [channelId]
  );

  const openThread = useCallback(
    (message: ChatMessageResultData) => {
      router.push(`/chat/thread/${message.ChatMessageId}?channelId=${channelId ?? ''}` as Href);
    },
    [router, channelId]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageResultData }) => (
      <MessageBubble
        message={item}
        isOwn={!!item.SenderUserId && item.SenderUserId === currentUserId}
        showSender={showSender}
        currentUserId={currentUserId}
        onLongPress={setActionsMessage}
        onToggleReaction={handleToggleReaction}
        onOpenThread={openThread}
        onRetry={(m) => m.ClientMessageId && useChatStore.getState().retryOutboxItem(m.ClientMessageId)}
        onPressImage={setImageUri}
      />
    ),
    [currentUserId, showSender, handleToggleReaction, openThread]
  );

  const keyExtractor = useCallback((item: ChatMessageResultData) => item.ChatMessageId, []);

  const handleEndReached = useCallback(() => {
    if (channelId) void useChatStore.getState().loadOlderMessages(channelId);
  }, [channelId]);

  // Chat.System feature flag off: no chat for this department.
  if (!isChatEnabled) {
    return <Redirect href={'/home' as Href} />;
  }

  const title = channel ? getChannelDisplayName(channel, t) : t('chat.title');

  return (
    <Box className="size-full flex-1 bg-background-0">
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerBackTitle: '',
          headerRight: () => (isDm ? <Circle size={12} color={otherOnline ? '#22c55e' : '#9ca3af'} fill={otherOnline ? '#22c55e' : '#9ca3af'} /> : undefined),
        }}
      />

      <AckBanner acks={channelAcks} onAcknowledge={(messageId) => useChatStore.getState().acknowledgeMessage(messageId)} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {loading && inverted.length === 0 ? (
          <Center className="flex-1">
            <Spinner />
          </Center>
        ) : (
          <FlatList
            data={inverted}
            inverted
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            removeClippedSubviews
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}

        <TypingIndicator names={typingNames} />

        <MessageComposer
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendLocation={handleSendLocation}
          onOpenGif={() => setGifOpen(true)}
          onTyping={(isTyping) => channelId && useChatStore.getState().sendTyping(channelId, isTyping)}
          disabled={channel?.IsLocked && !isModerator}
        />
      </KeyboardAvoidingView>

      <GifPickerSheet isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleSendGif} />

      <MessageActionsSheet
        message={actionsMessage}
        isOpen={actionsMessage !== null}
        onClose={() => setActionsMessage(null)}
        isOwn={!!actionsMessage?.SenderUserId && actionsMessage.SenderUserId === currentUserId}
        isModerator={isModerator}
        onReact={(m, emoji) =>
          handleToggleReaction(
            m,
            emoji,
            m.Reactions.some((r) => r.Emoji === emoji && r.UserId === currentUserId)
          )
        }
        onReply={openThread}
        onCopy={async (m) => {
          const ok = await copyToClipboard(m.Body ?? '');
          useToastStore.getState().showToast(ok ? 'success' : 'info', ok ? t('chat.copied') : t('chat.copy_unavailable'));
        }}
        onEdit={(m) => {
          setEditMessage(m);
          setEditText(m.Body ?? '');
        }}
        onDelete={(m) => channelId && useChatStore.getState().deleteMessage(m.ChatMessageId, channelId)}
        onFlag={(m, reason) => useChatStore.getState().flagMessage(m.ChatMessageId, reason)}
        onTogglePin={(m, pinned) => channelId && useChatStore.getState().togglePin(m.ChatMessageId, channelId, pinned)}
        onModeratorDelete={(m) => channelId && useChatStore.getState().moderatorDeleteMessage(m.ChatMessageId, channelId, t('chat.moderator_removed'))}
      />

      {/* Edit message sheet */}
      <Actionsheet isOpen={editMessage !== null} onClose={() => setEditMessage(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full p-2" space="md">
            <Text className="text-base font-semibold text-typography-900">{t('chat.edit_message')}</Text>
            <Textarea>
              <TextareaInput value={editText} onChangeText={setEditText} multiline />
            </Textarea>
            <Button
              className="bg-primary-600"
              onPress={() => {
                if (editMessage && channelId && editText.trim()) {
                  void useChatStore.getState().editMessage(editMessage.ChatMessageId, channelId, editText.trim());
                }
                setEditMessage(null);
              }}
            >
              <ButtonText>{t('chat.save')}</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {/* Full-screen image preview */}
      <Actionsheet isOpen={imageUri !== null} onClose={() => setImageUri(null)} snapPoints={[80]}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {imageUri ? (
            <Center className="w-full p-2">
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: 400, borderRadius: 12 }} contentFit="contain" />
            </Center>
          ) : null}
        </ActionsheetContent>
      </Actionsheet>
    </Box>
  );
}
