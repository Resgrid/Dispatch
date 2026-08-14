import { FlameIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useIsRunCardsEnabled } from '@/stores/feature-flags/store';
import { useRunCardsStore } from '@/stores/runcards/store';
import { useToastStore } from '@/stores/toast/store';

interface EscalateAlarmButtonProps {
  callId: string;
  /** Current alarm level from the call payload; 1 when the call has never been escalated. */
  alarmLevel: number;
  /** Null when no run card is driving this call — escalation has nothing to add. */
  activeRunCardId: number | null;
  /** False for a closed call or a user without edit rights. */
  canEscalate: boolean;
  onEscalated?: (newAlarmLevel: number) => void;
  testID?: string;
}

/**
 * "Strike Next Alarm".
 *
 * Escalation is additive: the server dispatches only the *next* level's requirements and notifies
 * only the newly added resources, so striking twice never re-alerts the crews already working the
 * call. It is also irreversible from here — there is no "unstrike" — hence the two-step confirm.
 *
 * Renders nothing unless the department has `Dispatch.RunCards` on AND a card is actually driving
 * this call: without a card the server would answer with a no-op, and offering a button that
 * silently does nothing is worse than not offering it.
 */
export const EscalateAlarmButton: React.FC<EscalateAlarmButtonProps> = ({ callId, alarmLevel, activeRunCardId, canEscalate, onEscalated, testID = 'escalate-alarm-button' }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isRunCardsEnabled = useIsRunCardsEnabled();
  const escalate = useRunCardsStore((state) => state.escalate);
  const isEscalating = useRunCardsStore((state) => state.isEscalating);
  const showToast = useToastStore((state) => state.showToast);
  const [isConfirming, setIsConfirming] = useState(false);

  const handlePress = useCallback(async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsConfirming(false);

    const result = await escalate(callId);

    if (!result) {
      showToast('error', t('run_cards.escalate_failed'));
      return;
    }

    if (!result.Success) {
      // The card has no level beyond the current one, or every resource it would add is already
      // on the call. Nothing went wrong — say so plainly instead of showing an error.
      showToast('info', t('run_cards.escalate_nothing_to_add'));
      return;
    }

    showToast(
      'success',
      t('run_cards.escalate_succeeded', {
        level: result.NewAlarmLevel,
        units: result.AddedUnits,
        personnel: result.AddedPersonnel,
      })
    );

    onEscalated?.(result.NewAlarmLevel);
  }, [isConfirming, escalate, callId, showToast, t, onEscalated]);

  const handleCancel = useCallback(() => setIsConfirming(false), []);

  if (!isRunCardsEnabled || !activeRunCardId || !canEscalate) {
    return null;
  }

  return (
    <VStack className="gap-2" testID={testID}>
      {isConfirming ? (
        <VStack className="gap-2">
          <Text className="text-sm text-neutral-500">{t('run_cards.escalate_confirm', { level: Math.max(1, alarmLevel) + 1 })}</Text>
          <HStack className="gap-2">
            <Button variant="outline" onPress={handleCancel} className="flex-1" testID={`${testID}-cancel`} isDisabled={isEscalating}>
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button variant="solid" action="negative" onPress={handlePress} className="flex-1" testID={`${testID}-confirm`} isDisabled={isEscalating}>
              {isEscalating ? <Spinner size="small" /> : null}
              <ButtonText>{t('run_cards.escalate_confirm_action')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Button variant="outline" action="secondary" onPress={handlePress} testID={`${testID}-trigger`} isDisabled={isEscalating}>
          <FlameIcon size={16} color={isDark ? '#fbbf24' : '#d97706'} />
          <ButtonText>{t('run_cards.escalate', { level: Math.max(1, alarmLevel) + 1 })}</ButtonText>
        </Button>
      )}
    </VStack>
  );
};
