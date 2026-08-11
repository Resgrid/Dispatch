import { type Href, Redirect, Stack, useFocusEffect } from 'expo-router';
import { RefreshCw, Send, Sparkles } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { copyToClipboard } from '@/components/chat/chat-utils';
import { MessageActionsSheet } from '@/components/chat/message-actions-sheet';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingDots } from '@/components/chat/typing-indicator';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ChatMessageResultData } from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';
import { useChatStore } from '@/stores/chat/store';
import { useChatSystemStatus } from '@/stores/feature-flags/store';
import { securityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

export default function ChatbotScreen() {
  const { t } = useTranslation();
  const chatStatus = useChatSystemStatus();
  const isChatEnabled = chatStatus === 'enabled';
  const currentUserId = useAuthStore((s) => s.userId);
  const chatbotChannelId = useChatStore((s) => s.chatbotChannelId);
  const chatbotTyping = useChatStore((s) => s.chatbotTyping);
  const messages = useChatStore((s) => (chatbotChannelId ? s.messagesByChannel[chatbotChannelId] : undefined));
  const isModerator = !!securityStore((s) => s.rights)?.IsAdmin;
  const [text, setText] = useState('');
  const [actionsMessage, setActionsMessage] = useState<ChatMessageResultData | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isChatEnabled) return;
      const store = useChatStore.getState();
      void store.initChatbot();
      return () => {
        useChatStore.getState().setActiveChannel(null);
      };
    }, [isChatEnabled])
  );

  // Keep the assistant channel active while viewing so incoming messages don't inflate unread.
  useFocusEffect(
    useCallback(() => {
      if (!isChatEnabled) return;
      if (chatbotChannelId) useChatStore.getState().setActiveChannel(chatbotChannelId);
    }, [chatbotChannelId, isChatEnabled])
  );

  const inverted = useMemo(() => (messages ? messages.slice().reverse() : []), [messages]);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    void useChatStore.getState().sendChatbotMessage(trimmed);
  }, [text]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageResultData }) => (
      <MessageBubble
        message={item}
        isOwn={!!item.SenderUserId && item.SenderUserId === currentUserId}
        showSender={false}
        currentUserId={currentUserId}
        onLongPress={setActionsMessage}
        onToggleReaction={() => undefined}
      />
    ),
    [currentUserId]
  );

  // Chat.System flag not yet resolved: wait instead of redirecting away from a valid route.
  if (chatStatus === 'unknown') {
    return (
      <Box className="size-full flex-1 items-center justify-center bg-background-0">
        <Stack.Screen options={{ headerShown: false }} />
        <FocusAwareStatusBar />
        <Spinner />
      </Box>
    );
  }

  // Chat.System feature flag off: the assistant rides on the chat system, hide it too.
  if (chatStatus === 'disabled') {
    return <Redirect href={'/home' as Href} />;
  }

  return (
    <Box className="size-full flex-1 bg-background-0">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />

      {/* Distinct assistant header */}
      <HStack className="items-center justify-between border-b border-outline-100 bg-purple-50 px-4 py-2 dark:bg-purple-950">
        <HStack className="items-center" space="sm">
          <Box className="size-8 items-center justify-center rounded-full bg-purple-600">
            <Sparkles size={18} color="#ffffff" />
          </Box>
          <VStack>
            <Text className="text-base font-bold text-typography-900">{t('chatbot.title')}</Text>
            <Text className="text-xs text-typography-400">{t('chatbot.subtitle')}</Text>
          </VStack>
        </HStack>
        <Pressable className="flex-row items-center rounded-full bg-purple-100 px-3 py-1 dark:bg-purple-900" onPress={() => useChatStore.getState().newChatbotSession()} accessibilityLabel={t('chatbot.new_session')}>
          <RefreshCw size={14} color="#7c3aed" />
          <Text className="ml-1 text-xs font-medium text-purple-700 dark:text-purple-300">{t('chatbot.new_session')}</Text>
        </Pressable>
      </HStack>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {inverted.length === 0 ? (
          <Center className="flex-1 px-8">
            <Sparkles size={48} color="#a78bfa" />
            <Text className="mt-3 text-center text-typography-400">{t('chatbot.empty')}</Text>
          </Center>
        ) : (
          <FlatList data={inverted} inverted keyExtractor={(item: ChatMessageResultData) => item.ChatMessageId} renderItem={renderItem} contentContainerStyle={{ paddingVertical: 8 }} />
        )}

        {chatbotTyping ? (
          <HStack className="items-center px-4 py-1" space="sm">
            <Box className="size-6 items-center justify-center rounded-full bg-purple-600">
              <Sparkles size={12} color="#ffffff" />
            </Box>
            <TypingDots color="#7c3aed" />
          </HStack>
        ) : null}

        <HStack className="items-end border-t border-outline-200 bg-background-0 p-2" space="sm">
          <Box className="flex-1">
            <Input className="rounded-2xl bg-background-100">
              <InputField placeholder={t('chatbot.ask_placeholder')} value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" />
            </Input>
          </Box>
          <Pressable className={`rounded-full p-2 ${text.trim() ? 'bg-purple-600' : 'bg-background-300'}`} onPress={send} disabled={!text.trim()} accessibilityLabel={t('chat.send')}>
            <Send size={20} color="#ffffff" />
          </Pressable>
        </HStack>
      </KeyboardAvoidingView>

      {/* Restricted actions for assistant messages: copy, pin (moderator), flag. */}
      <MessageActionsSheet
        message={actionsMessage}
        isOpen={actionsMessage !== null}
        onClose={() => setActionsMessage(null)}
        isOwn={!!actionsMessage?.SenderUserId && actionsMessage.SenderUserId === currentUserId}
        isModerator={isModerator}
        assistant
        onReact={() => undefined}
        onReply={() => undefined}
        onCopy={async (m) => {
          const ok = await copyToClipboard(m.Body ?? '');
          useToastStore.getState().showToast(ok ? 'success' : 'info', ok ? t('chat.copied') : t('chat.copy_unavailable'));
        }}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onFlag={(m, reason) => useChatStore.getState().flagMessage(m.ChatMessageId, reason)}
        onTogglePin={(m, pinned) => chatbotChannelId && useChatStore.getState().togglePin(m.ChatMessageId, chatbotChannelId, pinned)}
        onModeratorDelete={() => undefined}
      />
    </Box>
  );
}
