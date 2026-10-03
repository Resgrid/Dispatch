import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Lock } from '@/components/ui/lucide-icons';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { endSharedShift, IDLE_WARNING_SECONDS, lockSharedSession, reportOperatorActivity, SHIFT_NOTICE_SECONDS } from '@/lib/shared-session/controller';
import useAuthStore from '@/stores/auth/store';
import { useSharedSessionStore } from '@/stores/shared-session/store';

const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The shared bar (passkey plan section 10.5), like Core Web's shared workstation bar: which installation this is,
 * when it locks, and Lock / End shift. A minute before the idle lock it warns and offers "Stay signed in"; ten minutes
 * before the shift ends it says so. The server enforces both; this only shows them.
 */
export const SharedSessionBar: React.FC = () => {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const { shared, locked, idleLocksAt, shiftEndsAt, installationLabel } = useSharedSessionStore();
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const showing = signedIn && shared && !locked;

  useEffect(() => {
    if (!showing) {
      setConfirmEnd(false);
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showing]);

  if (!showing) {
    return null;
  }

  const remaining = idleLocksAt !== null ? Math.max(0, Math.ceil((idleLocksAt - now) / 1000)) : null;
  const idleWarning = remaining !== null && remaining <= IDLE_WARNING_SECONDS;
  const shiftEndsSoon = shiftEndsAt !== null && shiftEndsAt - now <= SHIFT_NOTICE_SECONDS * 1000;

  const finish = (switchOperator: boolean) => {
    setBusy(true);
    void endSharedShift(switchOperator).finally(() => setBusy(false));
  };

  return (
    <View className="border-b border-warning-300 bg-warning-50 px-3 py-1 dark:border-warning-700 dark:bg-warning-900" testID="shared-session-bar">
      <HStack space="sm" className="flex-wrap items-center justify-between">
        <Text size="xs" className="shrink font-medium" numberOfLines={1}>
          {installationLabel ? t('shared_session.bar_label', { label: installationLabel }) : t('shared_session.bar')}
          {remaining !== null ? ` · ${t('shared_session.locks_in', { time: clockText(remaining) })}` : ''}
        </Text>
        <HStack space="xs" className="items-center">
          {confirmEnd ? (
            <>
              <Button size="xs" variant="outline" action="secondary" onPress={() => finish(true)} isDisabled={busy} testID="shared-bar-switch">
                <ButtonText>{t('shared_session.switch_operator')}</ButtonText>
              </Button>
              <Button size="xs" variant="solid" action="negative" onPress={() => finish(false)} isDisabled={busy} testID="shared-bar-end-confirm">
                <ButtonText>{t('shared_session.end_shift')}</ButtonText>
              </Button>
              <Button size="xs" variant="link" action="secondary" onPress={() => setConfirmEnd(false)} isDisabled={busy} testID="shared-bar-end-cancel">
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
            </>
          ) : (
            <>
              <Button size="xs" variant="outline" action="secondary" onPress={() => void lockSharedSession('explicit')} testID="shared-bar-lock">
                <Lock size={12} style={{ marginRight: 4 }} />
                <ButtonText>{t('shared_session.lock')}</ButtonText>
              </Button>
              <Button size="xs" variant="outline" action="negative" onPress={() => setConfirmEnd(true)} testID="shared-bar-end">
                <ButtonText>{t('shared_session.end_shift')}</ButtonText>
              </Button>
            </>
          )}
        </HStack>
      </HStack>
      {idleWarning || shiftEndsSoon ? (
        <HStack space="sm" className="mt-1 items-center justify-between" testID="shared-session-warning">
          <Text size="xs" className="shrink text-warning-700 dark:text-warning-200" accessibilityLiveRegion="polite">
            {[
              idleWarning ? t('shared_session.idle_warning', { time: clockText(remaining ?? 0) }) : null,
              shiftEndsSoon && shiftEndsAt !== null ? t('shared_session.shift_ends_soon', { time: new Date(shiftEndsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
          {idleWarning ? (
            <Button size="xs" variant="solid" action="primary" onPress={() => reportOperatorActivity(true)} testID="shared-bar-stay">
              <ButtonText>{t('shared_session.stay')}</ButtonText>
            </Button>
          ) : null}
        </HStack>
      ) : null}
    </View>
  );
};
