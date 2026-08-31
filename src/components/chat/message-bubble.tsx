import { Image } from 'expo-image';
import { AlertTriangle, Clock, MapPin, MessageSquare, Pin, RefreshCw } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { getChatAttachmentImageSource } from '@/api/chat/chat';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ChatMessagePriority, type ChatMessageResultData, ChatMessageType } from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';

import { formatShortTime, getPersonAvatarUrl, linkifySegments, parseGifMetadata, parseLocationMetadata } from './chat-utils';

interface MessageBubbleProps {
  message: ChatMessageResultData;
  isOwn: boolean;
  showSender: boolean;
  currentUserId: string | null;
  onLongPress: (message: ChatMessageResultData) => void;
  onToggleReaction: (message: ChatMessageResultData, emoji: string, mine: boolean) => void;
  onOpenThread?: (message: ChatMessageResultData) => void;
  onRetry?: (message: ChatMessageResultData) => void;
  onPressImage?: (source: { uri: string; headers?: Record<string, string> }) => void;
}

export function MessageBubble({ message, isOwn, showSender, currentUserId, onLongPress, onToggleReaction, onOpenThread, onRetry, onPressImage }: MessageBubbleProps) {
  const { t } = useTranslation();

  // getChatAttachmentImageSource() bakes the bearer into the source object, so the bubble has to
  // re-render when the token rotates. Reading it from getState() alone leaves a mounted bubble
  // holding the pre-refresh token, and the image request then 401s.
  const accessToken = useAuthStore((state) => state.accessToken);

  // Realtime payloads omit empty collections; the store normalizes them, but messages
  // persisted before that normalization existed can still come back without them.
  const groupedReactions = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const reaction of message.Reactions ?? []) {
      const current = map.get(reaction.Emoji) ?? { count: 0, mine: false };
      current.count += 1;
      if (reaction.UserId && reaction.UserId === currentUserId) current.mine = true;
      map.set(reaction.Emoji, current);
    }
    return Array.from(map.entries());
  }, [message.Reactions, currentUserId]);

  // System message: centered, subtle.
  if (message.MessageType === ChatMessageType.System) {
    return (
      <Box className="my-1 items-center px-4">
        <Text className="text-center text-xs text-typography-400">{message.Body}</Text>
      </Box>
    );
  }

  const isDeleted = !!message.DeletedOn;
  const isUrgent = message.Priority === ChatMessagePriority.Urgent;
  const isPending = message._localStatus === 'pending';
  const isFailed = message._localStatus === 'failed';

  const bubbleTone = isOwn ? 'bg-primary-600' : 'bg-background-100';
  const textTone = isOwn ? 'text-white' : 'text-typography-900';
  const urgentClasses = isUrgent && !isOwn ? 'border-2 border-error-500 bg-error-50' : isUrgent && isOwn ? 'border-2 border-error-300' : '';

  const renderBody = () => {
    if (isDeleted) {
      return <Text className={`italic ${isOwn ? 'text-white/70' : 'text-typography-400'}`}>{t('chat.message_deleted')}</Text>;
    }

    if (message.MessageType === ChatMessageType.Image) {
      const attachment = (message.Attachments ?? [])[0];
      const localUri = message._localAttachmentUri;
      // Full source object (uri + Authorization header) travels with the press so the
      // full-screen preview stays authenticated — extracting only .uri drops the bearer.
      const source = localUri ? { uri: localUri } : attachment ? getChatAttachmentImageSource(attachment.ChatAttachmentId, accessToken) : undefined;
      if (!source?.uri) return <Text className={textTone}>{message.Body}</Text>;
      return (
        <Pressable onPress={() => onPressImage?.(source as { uri: string; headers?: Record<string, string> })}>
          <Image source={source} style={{ width: 200, height: 200, borderRadius: 10 }} contentFit="cover" />
          {message.Body ? <Text className={`mt-1 ${textTone}`}>{message.Body}</Text> : null}
        </Pressable>
      );
    }

    if (message.MessageType === ChatMessageType.Gif) {
      const gif = parseGifMetadata(message.MetadataJson);
      if (gif?.GifUrl) {
        return <Image source={{ uri: gif.GifUrl }} style={{ width: 200, height: 160, borderRadius: 10 }} contentFit="contain" />;
      }
      return <Text className={textTone}>{message.Body}</Text>;
    }

    if (message.MessageType === ChatMessageType.Location) {
      const loc = parseLocationMetadata(message.MetadataJson);
      if (loc) {
        return (
          <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${loc.Latitude},${loc.Longitude}`)}>
            <HStack className="items-center" space="sm">
              <MapPin size={18} color={isOwn ? '#ffffff' : '#2563eb'} />
              <Text className={textTone}>{loc.Label ?? t('chat.shared_location')}</Text>
            </HStack>
          </Pressable>
        );
      }
    }

    // Text (with inline links).
    const segments = linkifySegments(message.Body ?? '');
    if (segments.length === 0) return <Text className={textTone}>{message.Body}</Text>;
    return (
      <Text className={textTone}>
        {segments.map((segment, index) =>
          segment.isLink ? (
            <Text key={index} className={`underline ${isOwn ? 'text-white' : 'text-primary-600'}`} onPress={() => Linking.openURL(segment.text)}>
              {segment.text}
            </Text>
          ) : (
            <Text key={index} className={textTone}>
              {segment.text}
            </Text>
          )
        )}
      </Text>
    );
  };

  return (
    <HStack className={`my-1 px-3 ${isOwn ? 'justify-end' : 'justify-start'}`} space="sm">
      {/* No initials fallback: the avatar endpoint always answers with a silhouette
          placeholder rather than a 404, so initials would never be visible anyway. */}
      {!isOwn && showSender ? <Avatar size="sm">{message.SenderUserId ? <AvatarImage source={{ uri: getPersonAvatarUrl(message.SenderUserId) ?? '' }} /> : null}</Avatar> : !isOwn ? <Box className="w-8" /> : null}

      <VStack className={`max-w-[78%] ${isOwn ? 'items-end' : 'items-start'}`} space="xs">
        {!isOwn && showSender && message.SenderDisplayName ? <Text className="ml-1 text-xs font-medium text-typography-500">{message.SenderDisplayName}</Text> : null}

        <Pressable onLongPress={() => onLongPress(message)} delayLongPress={250}>
          <Box className={`rounded-2xl px-3 py-2 ${bubbleTone} ${urgentClasses}`}>
            {isUrgent && !isDeleted ? (
              <HStack className="mb-1 items-center" space="xs">
                <AlertTriangle size={14} color={isOwn ? '#ffffff' : '#dc2626'} />
                <Text className={`text-xs font-bold ${isOwn ? 'text-white' : 'text-error-600'}`}>{t('chat.urgent')}</Text>
              </HStack>
            ) : null}
            {renderBody()}
          </Box>
        </Pressable>

        {groupedReactions.length > 0 ? (
          <HStack className="flex-wrap" space="xs">
            {groupedReactions.map(([emoji, info]) => (
              <Pressable key={emoji} onPress={() => onToggleReaction(message, emoji, info.mine)}>
                <Box className={`flex-row items-center rounded-full px-2 py-0.5 ${info.mine ? 'bg-primary-100' : 'bg-background-200'}`}>
                  <Text className="text-xs">
                    {emoji} {info.count}
                  </Text>
                </Box>
              </Pressable>
            ))}
          </HStack>
        ) : null}

        {message.ThreadReplyCount > 0 && onOpenThread ? (
          <Pressable onPress={() => onOpenThread(message)}>
            <HStack className="items-center" space="xs">
              <MessageSquare size={12} color="#6b7280" />
              <Text className="text-xs text-primary-600">{t('chat.thread_replies', { count: message.ThreadReplyCount })}</Text>
            </HStack>
          </Pressable>
        ) : null}

        <HStack className="items-center" space="xs">
          {message.PinnedOn ? <Pin size={11} color="#9ca3af" /> : null}
          {message.EditedOn && !isDeleted ? <Text className="text-[10px] text-typography-400">{t('chat.edited')}</Text> : null}
          <Text className="text-[10px] text-typography-400">{formatShortTime(message.SentOn)}</Text>
          {isPending ? <Clock size={11} color="#9ca3af" /> : null}
          {isFailed ? (
            <Pressable onPress={() => onRetry?.(message)}>
              <HStack className="items-center" space="xs">
                <RefreshCw size={11} color="#dc2626" />
                <Text className="text-[10px] text-error-600">{t('chat.failed_tap_retry')}</Text>
              </HStack>
            </Pressable>
          ) : null}
        </HStack>
      </VStack>
    </HStack>
  );
}
