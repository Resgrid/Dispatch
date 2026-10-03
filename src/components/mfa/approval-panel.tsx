import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface ApprovalPanelProps {
  /** The two-digit number the member types in Responder; shown on this screen only. */
  matchNumber: string;
  onCancel: () => void;
}

/**
 * "Approve with Responder" while it waits (passkey plan section 7.9): the number to type in Responder, and a way to stop
 * waiting. The number is never pushed to Responder, so it only works for someone who can see this screen.
 */
export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ matchNumber, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Box className="rounded-lg bg-background-50 p-4" testID="mfa-approval-panel">
      <VStack space="sm" className="items-center">
        <Text size="sm" className="text-center">
          {t('mfa.approval.number_label')}
        </Text>
        <Text className="text-4xl font-bold tracking-widest" testID="mfa-approval-number" accessibilityLabel={t('mfa.approval.number_accessibility', { number: matchNumber })}>
          {matchNumber}
        </Text>
        <Text size="sm" className="text-center text-typography-500" accessibilityLiveRegion="polite">
          {t('mfa.approval.waiting')}
        </Text>
        <Button variant="outline" action="secondary" size="sm" onPress={onCancel} testID="mfa-approval-cancel">
          <ButtonText>{t('mfa.approval.cancel')}</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};
