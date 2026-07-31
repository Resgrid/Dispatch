import { Check, Search, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createAdHocChannel, createDirectMessage } from '@/api/chat/chat';
import { getRecipients } from '@/api/messaging/messages';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { getAvatarUrl } from '@/lib/utils';
import { type RecipientsResultData } from '@/models/v4/messages/recipientsResultData';
import { useToastStore } from '@/stores/toast/store';

interface NewConversationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'dm' | 'group';
  onCreated: (channelId: string) => void;
}

/** Strips a possible "P:" / "U:" style prefix from a recipient id. */
function recipientUserId(recipient: RecipientsResultData): string {
  return recipient.Id.includes(':') ? (recipient.Id.split(':').pop() ?? recipient.Id) : recipient.Id;
}

function isPersonRecipient(recipient: RecipientsResultData): boolean {
  const type = (recipient.Type ?? '').toLowerCase();
  return type === 'personnel' || type === 'person' || type === 'user' || type === 'p' || type === '';
}

export function NewConversationSheet({ isOpen, onClose, mode, onCreated }: NewConversationSheetProps) {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState<RecipientsResultData[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setGroupName('');
    setQuery('');
    setLoading(true);
    getRecipients(true, false)
      .then((result) => setRecipients((result.Data ?? []).filter(isPersonRecipient)))
      .catch((error) => logger.error({ message: 'chat: failed to load recipients', context: { error } }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.Name.toLowerCase().includes(q));
  }, [recipients, query]);

  const toggle = useCallback((userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const startDirectMessage = useCallback(
    async (recipient: RecipientsResultData) => {
      setSubmitting(true);
      try {
        const response = await createDirectMessage({ TargetUserId: recipientUserId(recipient) });
        if (response.Data?.ChatChannelId) {
          onCreated(response.Data.ChatChannelId);
          onClose();
        }
      } catch (error) {
        logger.error({ message: 'chat: create DM failed', context: { error } });
        useToastStore.getState().showToast('error', t('chat.create_conversation_failed'));
      } finally {
        setSubmitting(false);
      }
    },
    [onCreated, onClose, t]
  );

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || selected.size === 0) return;
    setSubmitting(true);
    try {
      const response = await createAdHocChannel({ Name: groupName.trim(), MemberUserIds: Array.from(selected) });
      if (response.Data?.ChatChannelId) {
        onCreated(response.Data.ChatChannelId);
        onClose();
      }
    } catch (error) {
      logger.error({ message: 'chat: create group failed', context: { error } });
      useToastStore.getState().showToast('error', t('chat.create_conversation_failed'));
    } finally {
      setSubmitting(false);
    }
  }, [groupName, selected, onCreated, onClose, t]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack className="w-full px-2" space="sm">
          <Text className="text-center text-base font-semibold text-typography-900">{mode === 'dm' ? t('chat.new_direct_message') : t('chat.new_group')}</Text>

          {mode === 'group' ? (
            <Input>
              <InputField placeholder={t('chat.group_name')} value={groupName} onChangeText={setGroupName} />
            </Input>
          ) : null}

          <Input className="rounded-full">
            <InputSlot className="pl-3">
              <InputIcon as={Search} />
            </InputSlot>
            <InputField placeholder={t('chat.search_people')} value={query} onChangeText={setQuery} />
          </Input>

          {loading ? (
            <Center className="h-40">
              <Spinner />
            </Center>
          ) : filtered.length === 0 ? (
            <Center className="h-40">
              <Text className="text-typography-400">{t('chat.no_people')}</Text>
            </Center>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {filtered.map((recipient) => {
                const userId = recipientUserId(recipient);
                const isSelected = selected.has(userId);
                return (
                  <Pressable
                    key={recipient.Id}
                    className="py-2"
                    onPress={() => (mode === 'dm' ? startDirectMessage(recipient) : toggle(userId))}
                    disabled={submitting}
                  >
                    <HStack className="items-center justify-between">
                      <HStack className="flex-1 items-center" space="sm">
                        <Avatar size="sm">
                          <AvatarFallbackText>{recipient.Name}</AvatarFallbackText>
                          <AvatarImage source={{ uri: getAvatarUrl(userId) }} />
                        </Avatar>
                        <Text className="flex-1 text-typography-900" numberOfLines={1}>
                          {recipient.Name}
                        </Text>
                      </HStack>
                      {mode === 'group' && isSelected ? (
                        <Box className="rounded-full bg-primary-600 p-1">
                          <Check size={14} color="#ffffff" />
                        </Box>
                      ) : null}
                    </HStack>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {mode === 'group' ? (
            <Button className="mb-2 w-full bg-primary-600" onPress={createGroup} isDisabled={submitting || !groupName.trim() || selected.size === 0}>
              <Users size={18} color="#ffffff" />
              <ButtonText className="ml-2">{t('chat.create_group_with', { count: selected.size })}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
