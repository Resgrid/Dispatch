import { AlertTriangle } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ChatAckResultData } from '@/models/v4/chat';

interface AckBannerProps {
  acks: ChatAckResultData[];
  onAcknowledge: (messageId: string) => void;
}

/** Sticky banner prompting the user to acknowledge the oldest pending urgent message. */
export function AckBanner({ acks, onAcknowledge }: AckBannerProps) {
  const { t } = useTranslation();
  if (acks.length === 0) return null;

  const oldest = acks.reduce((a, b) => (new Date(a.RequiredOn).getTime() <= new Date(b.RequiredOn).getTime() ? a : b));

  return (
    <HStack className="items-center justify-between border-b border-error-300 bg-error-50 px-4 py-2" space="sm">
      <HStack className="flex-1 items-center" space="sm">
        <AlertTriangle size={18} color="#dc2626" />
        <VStack className="flex-1">
          <Text className="text-sm font-semibold text-error-700">{t('chat.ack_required')}</Text>
          <Text className="text-xs text-error-600">{acks.length > 1 ? t('chat.ack_pending_count', { count: acks.length }) : t('chat.ack_pending_one')}</Text>
        </VStack>
      </HStack>
      <Button size="sm" className="bg-error-600" onPress={() => onAcknowledge(oldest.ChatMessageId)}>
        <ButtonText>{t('chat.acknowledge')}</ButtonText>
      </Button>
    </HStack>
  );
}
