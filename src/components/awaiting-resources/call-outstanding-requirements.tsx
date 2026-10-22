import { HourglassIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';

import { getCallRequirements } from '@/api/awaitingResources/awaitingResources';
import { ResponseCodeChip } from '@/components/runcards/response-code-chip';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { type CallOutstandingRequirementData } from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';

/** The server keeps up to 1000 characters of the note. */
const NOTE_MAX_LENGTH = 1000;

interface CallOutstandingRequirementsProps {
  callId: string;
  /** Dismissing needs the same authority as editing the call. */
  canDismiss: boolean;
  testID?: string;
}

/**
 * Confirms a dismiss in place, with an optional note, so the call detail needs no modal of its own: what is awaited,
 * why it is no longer needed, Dismiss or Cancel.
 */
const DismissInline: React.FC<{ requirement: CallOutstandingRequirementData; isBusy: boolean; isDark: boolean; onConfirm: (note: string) => void; onCancel: () => void; testID: string }> = ({
  requirement,
  isBusy,
  isDark,
  onConfirm,
  onCancel,
  testID,
}) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  return (
    <VStack className="mt-2 gap-2" testID={`${testID}-confirm`}>
      <Text className="text-xs text-neutral-700 dark:text-neutral-300">{t('awaiting_resources.dismiss_confirm', { label: requirement.Label })}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('awaiting_resources.dismiss_note_placeholder')}
        placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
        maxLength={NOTE_MAX_LENGTH}
        editable={!isBusy}
        accessibilityLabel={t('awaiting_resources.dismiss_note_placeholder')}
        style={{
          borderWidth: 1,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          fontSize: 13,
          borderColor: isDark ? '#4b5563' : '#d1d5db',
          color: isDark ? '#f3f4f6' : '#111827',
          backgroundColor: isDark ? '#111827' : '#ffffff',
        }}
        testID={`${testID}-note`}
      />
      <HStack className="justify-end gap-2">
        <Button size="xs" variant="outline" action="secondary" onPress={onCancel} isDisabled={isBusy} testID={`${testID}-cancel`}>
          <ButtonText>{t('common.cancel')}</ButtonText>
        </Button>
        <Button size="xs" action="negative" onPress={() => onConfirm(note.trim())} isDisabled={isBusy} testID={`${testID}-confirm-button`}>
          <ButtonText>{t('awaiting_resources.dismiss')}</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
};

/**
 * A call's open outstanding requirements (conditional run cards): what the call is still awaiting because it could not
 * be sent as configured, with what went instead, and a Dismiss for each. Refreshed on every
 * `outstandingRequirementsUpdated` push. Renders nothing when the call awaits nothing or the department does not have
 * Dispatch.RunCardConditions.
 */
export const CallOutstandingRequirements: React.FC<CallOutstandingRequirementsProps> = ({ callId, canDismiss, testID = 'call-outstanding-requirements' }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isEnabled = useIsRunCardConditionsEnabled();
  // Bumped by every outstandingRequirementsUpdated push (the SignalR store forwards it to the awaiting store).
  const lastPushAt = useAwaitingResourcesStore((state) => state.lastPushAt);
  const busyKey = useAwaitingResourcesStore((state) => state.busyKey);
  const allResponseCodes = useAwaitingResourcesStore((state) => state.allResponseCodes);
  const dismissRequirement = useAwaitingResourcesStore((state) => state.dismissRequirement);

  const [requirements, setRequirements] = useState<CallOutstandingRequirementData[]>([]);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;

    if (!isEnabled || !callId) {
      setRequirements([]);
      return;
    }

    try {
      const data = await getCallRequirements(callId);
      if (request === requestRef.current) {
        setRequirements(data);
      }
    } catch (error) {
      // Advisory on this screen: a failed read leaves the call detail as it was.
      logger.warn({
        message: 'Failed to fetch outstanding requirements for call',
        context: { error, callId },
      });
    }
  }, [callId, isEnabled]);

  useEffect(() => {
    void load();
  }, [load, lastPushAt]);

  const handleDismiss = useCallback(
    async (requirement: CallOutstandingRequirementData, note: string) => {
      const dismissed = await dismissRequirement(requirement.CallId, requirement.CallOutstandingRequirementId, note);
      if (dismissed) {
        setConfirmingId(null);
      }
      void load();
    },
    [dismissRequirement, load]
  );

  if (!isEnabled || requirements.length === 0) {
    return null;
  }

  return (
    <Box className={`mb-4 rounded-lg border p-3 ${isDark ? 'border-amber-800 bg-amber-950' : 'border-amber-300 bg-amber-50'}`} testID={testID}>
      <HStack className="mb-2 items-center gap-2">
        <HourglassIcon size={16} color="#d97706" />
        <Text className="font-semibold text-amber-800 dark:text-amber-300">{t('awaiting_resources.call_section_title')}</Text>
      </HStack>
      <VStack className="gap-2">
        {requirements.map((requirement) => {
          const code = requirement.ResponseCodeId ? allResponseCodes.find((entry) => entry.Id === requirement.ResponseCodeId) : undefined;
          const isBusy = busyKey === `dismiss:${requirement.CallOutstandingRequirementId}`;
          const rowTestID = `${testID}-${requirement.CallOutstandingRequirementId}`;

          return (
            <VStack key={`call-req-${requirement.CallOutstandingRequirementId}`} testID={rowTestID}>
              <HStack className="items-center justify-between gap-2">
                <VStack className="flex-1">
                  <HStack className="flex-wrap items-center gap-2">
                    <Text className="text-sm font-medium">{t('awaiting_resources.requirement_progress', { label: requirement.Label, resolved: requirement.ResolvedCount, required: requirement.RequiredCount })}</Text>
                    <ResponseCodeChip code={requirement.ResponseCode} name={code?.Name} color={code?.Color} testID={`${rowTestID}-code`} />
                  </HStack>
                  {requirement.SentInstead ? <Text className="text-xs text-neutral-600 dark:text-neutral-300">{t('awaiting_resources.sent_instead', { sent: requirement.SentInstead })}</Text> : null}
                </VStack>
                {canDismiss && confirmingId !== requirement.CallOutstandingRequirementId ? (
                  <Button size="xs" variant="outline" action="secondary" onPress={() => setConfirmingId(requirement.CallOutstandingRequirementId)} isDisabled={isBusy} testID={`${rowTestID}-dismiss`}>
                    <ButtonText>{t('awaiting_resources.dismiss')}</ButtonText>
                  </Button>
                ) : null}
              </HStack>
              {canDismiss && confirmingId === requirement.CallOutstandingRequirementId ? (
                <DismissInline requirement={requirement} isBusy={isBusy} isDark={isDark} onConfirm={(note) => void handleDismiss(requirement, note)} onCancel={() => setConfirmingId(null)} testID={rowTestID} />
              ) : null}
            </VStack>
          );
        })}
      </VStack>
    </Box>
  );
};
