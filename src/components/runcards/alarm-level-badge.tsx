import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { useIsRunCardsEnabled } from '@/stores/feature-flags/store';

interface AlarmLevelBadgeProps {
  /** Alarm level from the call payload. 1 (or 0 on pre-run-card calls) means never escalated. */
  alarmLevel: number | null | undefined;
  testID?: string;
}

/**
 * Shows a call's alarm level once it has been escalated above the first.
 *
 * Hidden at level 1: every call is a first alarm, so badging them all would be noise that hides the
 * handful that actually matter. Also hidden when run cards are off — alarm levels only move through
 * a run card, so the field is meaningless to a department that does not use them.
 */
export const AlarmLevelBadge: React.FC<AlarmLevelBadgeProps> = ({ alarmLevel, testID = 'alarm-level-badge' }) => {
  const { t } = useTranslation();
  const isRunCardsEnabled = useIsRunCardsEnabled();

  if (!isRunCardsEnabled || typeof alarmLevel !== 'number' || alarmLevel <= 1) {
    return null;
  }

  return (
    <Badge action="warning" testID={testID}>
      <BadgeText>{t('run_cards.alarm_level', { level: alarmLevel })}</BadgeText>
    </Badge>
  );
};
