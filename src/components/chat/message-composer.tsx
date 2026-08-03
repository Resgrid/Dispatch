import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AlertTriangle, ImagePlus, MapPin, Send, Smile, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { logger } from '@/lib/logging';
import { useToastStore } from '@/stores/toast/store';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '🔥', '😮', '😢', '👏', '✅', '🚒', '🚑', '👀', '💯', '🆗', '⚠️'];
const TYPING_IDLE_MS = 3000;

interface MessageComposerProps {
  onSendText: (body: string, urgent: boolean) => void;
  onSendImage: (uri: string, urgent: boolean, mimeType?: string) => void;
  onSendLocation: (latitude: number, longitude: number, urgent: boolean) => void;
  onOpenGif: () => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({ onSendText, onSendImage, onSendLocation, onOpenGif, onTyping, disabled, placeholder }: MessageComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const typingActive = useRef(false);
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (typingIdleTimer.current) {
      clearTimeout(typingIdleTimer.current);
      typingIdleTimer.current = null;
    }
    if (typingActive.current) {
      typingActive.current = false;
      onTyping(false);
    }
  }, [onTyping]);

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      if (value.length > 0) {
        if (!typingActive.current) {
          typingActive.current = true;
          onTyping(true);
        }
        if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
        typingIdleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
      } else {
        stopTyping();
      }
    },
    [onTyping, stopTyping]
  );

  useEffect(() => {
    return () => {
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed, urgent);
    setText('');
    setUrgent(false);
    stopTyping();
  }, [text, urgent, onSendText, stopTyping]);

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        useToastStore.getState().showToast('error', t('chat.permission_photos_denied'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]?.uri) {
        onSendImage(result.assets[0].uri, urgent, result.assets[0].mimeType ?? undefined);
        setUrgent(false);
      }
    } catch (error) {
      logger.error({ message: 'chat: image pick failed', context: { error } });
    }
  }, [onSendImage, urgent, t]);

  const handleShareLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        useToastStore.getState().showToast('error', t('chat.permission_location_denied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      onSendLocation(position.coords.latitude, position.coords.longitude, urgent);
      setUrgent(false);
    } catch (error) {
      logger.error({ message: 'chat: location share failed', context: { error } });
    }
  }, [onSendLocation, urgent, t]);

  return (
    <Box className="border-t border-outline-200 bg-background-0 px-2 pb-2 pt-1" style={Platform.OS === 'ios' ? { paddingBottom: 8 } : undefined}>
      <HStack className="items-end" space="xs">
        <Pressable className="p-2" onPress={() => setEmojiOpen(true)} accessibilityLabel={t('chat.emoji')}>
          <Smile size={22} color="#6b7280" />
        </Pressable>

        <Box className="flex-1">
          <Textarea size="md" className="min-h-[40px] rounded-2xl bg-background-100">
            <TextareaInput placeholder={placeholder ?? t('chat.type_a_message')} value={text} onChangeText={handleChange} onBlur={stopTyping} multiline editable={!disabled} />
          </Textarea>
        </Box>

        <Pressable className="p-2" onPress={handlePickImage} disabled={disabled} accessibilityLabel={t('chat.add_image')}>
          <ImagePlus size={22} color="#6b7280" />
        </Pressable>
        <Pressable className="p-2" onPress={onOpenGif} disabled={disabled} accessibilityLabel={t('chat.add_gif')}>
          <Sparkles size={22} color="#6b7280" />
        </Pressable>
        <Pressable className="p-2" onPress={handleShareLocation} disabled={disabled} accessibilityLabel={t('chat.share_location')}>
          <MapPin size={22} color="#6b7280" />
        </Pressable>
        <Pressable className="p-2" onPress={() => setUrgent((prev) => !prev)} disabled={disabled} accessibilityLabel={t('chat.urgent')}>
          <AlertTriangle size={22} color={urgent ? '#dc2626' : '#6b7280'} />
        </Pressable>

        <Pressable className={`rounded-full p-2 ${text.trim() ? 'bg-primary-600' : 'bg-background-300'}`} onPress={handleSend} disabled={!text.trim() || disabled} accessibilityLabel={t('chat.send')}>
          <Send size={20} color="#ffffff" />
        </Pressable>
      </HStack>

      {urgent ? (
        <HStack className="mt-1 items-center px-2" space="xs">
          <AlertTriangle size={12} color="#dc2626" />
          <Text className="text-xs text-error-600">{t('chat.urgent_will_send')}</Text>
        </HStack>
      ) : null}

      <Actionsheet isOpen={emojiOpen} onClose={() => setEmojiOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <HStack className="flex-wrap justify-center p-2" space="md">
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                className="p-2"
                onPress={() => {
                  setText((prev) => prev + emoji);
                  setEmojiOpen(false);
                }}
              >
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </HStack>
        </ActionsheetContent>
      </Actionsheet>
    </Box>
  );
}
