import { type Href, Stack, useFocusEffect, useRouter } from 'expo-router';
import { Bot, MessageCircle, MessagesSquare, Network, Plus, Sparkles, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { AckBanner } from '@/components/chat/ack-banner';
import { getChannelDisplayName, groupChannels } from '@/components/chat/chat-utils';
import { NewConversationSheet } from '@/components/chat/new-conversation-sheet';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '@/components/ui/actionsheet';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ChatChannelResultData, ChatChannelType } from '@/models/v4/chat';
import { useChatStore } from '@/stores/chat/store';

function ChannelRow({ channel, onPress }: { channel: ChatChannelResultData; onPress: () => void }) {
  const { t } = useTranslation();
  const unread = channel.UnreadCount > 0;
  const isDm = channel.ChannelType === ChatChannelType.DirectMessage;

  const Leading = () => {
    if (isDm) {
      return (
        <Avatar size="md">
          <AvatarFallbackText>{getChannelDisplayName(channel, t)}</AvatarFallbackText>
        </Avatar>
      );
    }
    const isIncident = channel.ChannelType === ChatChannelType.Incident || channel.ChannelType === ChatChannelType.IncidentLane || channel.ChannelType === ChatChannelType.IncidentCommand;
    const Icon = channel.ChannelType === ChatChannelType.Chatbot ? Sparkles : isIncident ? Network : Users;
    return (
      <Box className="size-10 items-center justify-center rounded-full bg-primary-100">
        <Icon size={20} color="#2563eb" />
      </Box>
    );
  };

  return (
    <Pressable onPress={onPress} className="px-4 py-3">
      <HStack className="items-center" space="md">
        <Leading />
        <VStack className="flex-1">
          <Text className={`text-typography-900 ${unread ? 'font-bold' : 'font-medium'}`} numberOfLines={1}>
            {getChannelDisplayName(channel, t)}
          </Text>
          {channel.Topic ? (
            <Text className="text-xs text-typography-400" numberOfLines={1}>
              {channel.Topic}
            </Text>
          ) : null}
        </VStack>
        {unread ? (
          <Badge className="rounded-full bg-primary-600" size="sm">
            <BadgeText className="text-white">{channel.UnreadCount > 99 ? '99+' : String(channel.UnreadCount)}</BadgeText>
          </Badge>
        ) : null}
      </HStack>
    </Pressable>
  );
}

function Section({ title, channels, onOpen }: { title: string; channels: ChatChannelResultData[]; onOpen: (id: string) => void }) {
  if (channels.length === 0) return null;
  return (
    <VStack className="mb-2">
      <Text className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-typography-400">{title}</Text>
      {channels.map((channel) => (
        <ChannelRow key={channel.ChatChannelId} channel={channel} onPress={() => onOpen(channel.ChatChannelId)} />
      ))}
    </VStack>
  );
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const channels = useChatStore((s) => s.channels);
  const isLoading = useChatStore((s) => s.isLoadingChannels);
  const pendingAcks = useChatStore((s) => s.pendingAcks);
  const [fabOpen, setFabOpen] = useState(false);
  const [newMode, setNewMode] = useState<'dm' | 'group' | null>(null);

  useFocusEffect(
    useCallback(() => {
      useChatStore.getState().fetchChannels();
      useChatStore.getState().fetchPendingAcks();
    }, [])
  );

  const grouped = groupChannels(channels);

  const openChannel = useCallback(
    (channelId: string) => {
      router.push(`/chat/${channelId}` as Href);
    },
    [router]
  );

  return (
    <Box className="size-full flex-1 bg-background-0">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />

      {/* In-screen toolbar (the app drawer provides the top nav bar). */}
      <HStack className="items-center justify-between border-b border-outline-100 px-4 py-2">
        <HStack className="items-center" space="sm">
          <MessagesSquare size={22} color="#2563eb" />
          <Text className="text-lg font-bold text-typography-900">{t('chat.title')}</Text>
        </HStack>
        <Pressable onPress={() => router.push('/chatbot' as Href)} accessibilityLabel={t('chat.assistant')}>
          <Sparkles size={22} color="#7c3aed" />
        </Pressable>
      </HStack>

      <AckBanner acks={pendingAcks} onAcknowledge={(messageId) => useChatStore.getState().acknowledgeMessage(messageId)} />

      <ScrollView className="flex-1" refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => useChatStore.getState().fetchChannels()} />}>
        {channels.length === 0 && !isLoading ? (
          <VStack className="mt-16 items-center px-8" space="sm">
            <MessageCircle size={48} color="#9ca3af" />
            <Text className="text-center text-typography-400">{t('chat.empty')}</Text>
          </VStack>
        ) : (
          <>
            <Section title={t('chat.section_assistant')} channels={grouped.assistant} onOpen={openChannel} />
            <Section title={t('chat.section_direct_messages')} channels={grouped.directMessages} onOpen={openChannel} />
            <Section title={t('chat.section_channels')} channels={grouped.channels} onOpen={openChannel} />
            <Section title={t('chat.section_incidents')} channels={grouped.incidents} onOpen={openChannel} />
          </>
        )}
        <Box className="h-24" />
      </ScrollView>

      <Fab placement="bottom right" onPress={() => setFabOpen(true)} className="bg-primary-600">
        <FabIcon as={Plus} />
      </Fab>

      {/* Choose new-conversation type */}
      <Actionsheet isOpen={fabOpen} onClose={() => setFabOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem
            onPress={() => {
              setFabOpen(false);
              setNewMode('dm');
            }}
          >
            <MessageCircle size={18} color="#6b7280" />
            <ActionsheetItemText>{t('chat.new_direct_message')}</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem
            onPress={() => {
              setFabOpen(false);
              setNewMode('group');
            }}
          >
            <Users size={18} color="#6b7280" />
            <ActionsheetItemText>{t('chat.new_group')}</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem
            onPress={() => {
              setFabOpen(false);
              router.push('/chatbot' as Href);
            }}
          >
            <Bot size={18} color="#6b7280" />
            <ActionsheetItemText>{t('chat.open_assistant')}</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>

      <NewConversationSheet
        isOpen={newMode !== null}
        mode={newMode ?? 'dm'}
        onClose={() => setNewMode(null)}
        onCreated={(channelId) => {
          setNewMode(null);
          openChannel(channelId);
        }}
      />
    </Box>
  );
}
