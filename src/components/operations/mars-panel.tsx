import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CalOesMarsQueueItem, CalOesMarsValidation } from '@/models/v4/operations';

interface MarsPanelProps {
  items: CalOesMarsQueueItem[];
  validation: CalOesMarsValidation | null;
  canDraft: boolean;
  busy: boolean;
  onDraft: () => void;
  onValidate: (workItemId: string) => void;
}

// CAL OES MARS (Phase C-M3) from the field: draft the F-42 from the deployment's time reports and run
// the portal validation. Submission itself stays a manual, audited hand-off on the web.
export const MarsPanel = ({ items, validation, canDraft, busy, onDraft, onValidate }: MarsPanelProps) => {
  const { t } = useTranslation();
  return (
    <VStack space="md">
      {items.length === 0 ? <Text className="text-typography-500">{t('operations.mars.none')}</Text> : null}
      {items.map((item) => (
        <VStack key={item.Id} space="xs" className="rounded-lg border border-outline-200 p-3">
          <HStack className="items-center justify-between">
            <Text className="font-semibold">{item.RecordTypeName ?? t('operations.mars.f42')}</Text>
            <Text className="text-typography-500">{item.LocalStateName ?? String(item.LocalState)}</Text>
          </HStack>
          {item.MarsRecordId ? <Text className="text-typography-500">{t('operations.mars.record', { id: item.MarsRecordId, status: item.ObservedExternalStatus ?? '—' })}</Text> : null}
          <Text className="text-typography-500">{t('operations.mars.counts', { errors: item.ErrorCount, warnings: item.WarningCount })}</Text>
          <Button variant="outline" size="sm" onPress={() => onValidate(item.Id)} isDisabled={busy} testID={`operations-mars-validate-${item.Id}`}>
            <ButtonText>{t('operations.mars.validate')}</ButtonText>
          </Button>
          {validation?.WorkItemId === item.Id ? (
            <VStack space="xs">
              <Text className={validation.IsReadyForPortal ? 'text-success-600' : 'text-error-600'}>{validation.IsReadyForPortal ? t('operations.mars.ready') : t('operations.mars.notReady')}</Text>
              {validation.Errors.map((issue, i) => (
                <Text key={`e-${i}`} accessibilityRole="alert" className="text-error-600">
                  {issue.Box ? `${issue.Box}: ` : ''}
                  {issue.Detail ?? issue.Code}
                </Text>
              ))}
              {validation.Warnings.map((issue, i) => (
                <Text key={`w-${i}`} className="text-warning-600">
                  {issue.Box ? `${issue.Box}: ` : ''}
                  {issue.Detail ?? issue.Code}
                </Text>
              ))}
            </VStack>
          ) : null}
        </VStack>
      ))}
      {canDraft ? (
        <Button onPress={onDraft} isDisabled={busy} testID="operations-mars-draft">
          <ButtonText>{t('operations.mars.draft')}</ButtonText>
        </Button>
      ) : null}
      <Text className="text-xs text-typography-500">{t('operations.mars.help')}</Text>
    </VStack>
  );
};
