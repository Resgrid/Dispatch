import { Copy, Flag, MessageSquare, Pencil, Pin, PinOff, ShieldX, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '@/components/ui/actionsheet';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { ChatFlagReason, type ChatMessageResultData, ChatMessageType } from '@/models/v4/chat';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '✅'];

interface MessageActionsSheetProps {
  message: ChatMessageResultData | null;
  isOpen: boolean;
  onClose: () => void;
  isOwn: boolean;
  isModerator: boolean;
  /** Assistant conversations: no reactions, threads, deletes or edits — copy, pin and flag stay. */
  assistant?: boolean;
  onReact: (message: ChatMessageResultData, emoji: string) => void;
  onReply: (message: ChatMessageResultData) => void;
  onCopy: (message: ChatMessageResultData) => void;
  onEdit: (message: ChatMessageResultData) => void;
  onDelete: (message: ChatMessageResultData) => void;
  onFlag: (message: ChatMessageResultData, reason: number) => void;
  onTogglePin: (message: ChatMessageResultData, pinned: boolean) => void;
  onModeratorDelete: (message: ChatMessageResultData) => void;
}

export function MessageActionsSheet({ message, isOpen, onClose, isOwn, isModerator, assistant = false, onReact, onReply, onCopy, onEdit, onDelete, onFlag, onTogglePin, onModeratorDelete }: MessageActionsSheetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'actions' | 'flag'>('actions');

  const close = () => {
    setMode('actions');
    onClose();
  };

  if (!message) return null;

  const isDeleted = !!message.DeletedOn;
  const isText = message.MessageType === ChatMessageType.Text;
  const isPinned = !!message.PinnedOn;

  const flagReasons: { reason: number; label: string }[] = [
    { reason: ChatFlagReason.Inappropriate, label: t('chat.flag_inappropriate') },
    { reason: ChatFlagReason.Harassment, label: t('chat.flag_harassment') },
    { reason: ChatFlagReason.Spam, label: t('chat.flag_spam') },
    { reason: ChatFlagReason.SensitiveInformation, label: t('chat.flag_sensitive') },
    { reason: ChatFlagReason.PolicyViolation, label: t('chat.flag_policy') },
    { reason: ChatFlagReason.Other, label: t('chat.flag_other') },
  ];

  return (
    <Actionsheet isOpen={isOpen} onClose={close}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {mode === 'flag' ? (
          <>
            <Text className="w-full px-4 py-2 text-sm font-semibold text-typography-500">{t('chat.flag_reason')}</Text>
            {flagReasons.map((item) => (
              <ActionsheetItem
                key={item.reason}
                onPress={() => {
                  onFlag(message, item.reason);
                  close();
                }}
              >
                <ActionsheetItemText>{item.label}</ActionsheetItemText>
              </ActionsheetItem>
            ))}
          </>
        ) : (
          <>
            {!isDeleted && !assistant ? (
              <HStack className="w-full justify-around px-2 py-3" space="sm">
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    className="p-1"
                    onPress={() => {
                      onReact(message, emoji);
                      close();
                    }}
                  >
                    <Text className="text-2xl">{emoji}</Text>
                  </Pressable>
                ))}
              </HStack>
            ) : null}

            {!assistant ? (
              <ActionsheetItem
                onPress={() => {
                  onReply(message);
                  close();
                }}
              >
                <MessageSquare size={18} color="#6b7280" />
                <ActionsheetItemText>{t('chat.reply_in_thread')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {isText && !isDeleted ? (
              <ActionsheetItem
                onPress={() => {
                  onCopy(message);
                  close();
                }}
              >
                <Copy size={18} color="#6b7280" />
                <ActionsheetItemText>{t('chat.copy')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {isOwn && isText && !isDeleted && !assistant ? (
              <ActionsheetItem
                onPress={() => {
                  onEdit(message);
                  close();
                }}
              >
                <Pencil size={18} color="#6b7280" />
                <ActionsheetItemText>{t('chat.edit')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {isOwn && !isDeleted && !assistant ? (
              <ActionsheetItem
                onPress={() => {
                  onDelete(message);
                  close();
                }}
              >
                <Trash2 size={18} color="#dc2626" />
                <ActionsheetItemText>{t('chat.delete')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {isModerator ? (
              <ActionsheetItem
                onPress={() => {
                  onTogglePin(message, !isPinned);
                  close();
                }}
              >
                {isPinned ? <PinOff size={18} color="#6b7280" /> : <Pin size={18} color="#6b7280" />}
                <ActionsheetItemText>{isPinned ? t('chat.unpin') : t('chat.pin')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {!isOwn && !isDeleted ? (
              <ActionsheetItem onPress={() => setMode('flag')}>
                <Flag size={18} color="#6b7280" />
                <ActionsheetItemText>{t('chat.flag')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}

            {isModerator && !isDeleted && !assistant ? (
              <ActionsheetItem
                onPress={() => {
                  onModeratorDelete(message);
                  close();
                }}
              >
                <ShieldX size={18} color="#dc2626" />
                <ActionsheetItemText>{t('chat.moderator_delete')}</ActionsheetItemText>
              </ActionsheetItem>
            ) : null}
          </>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}
