import { EyeIcon, EyeOffIcon, ShieldIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useProtectedReveal } from '@/hooks/use-protected-reveal';
import { logger } from '@/lib/logging';
import useAuthStore from '@/stores/auth/store';
import { useIsProtectionEnabled } from '@/stores/data-protection/store';

interface ProtectedRevealBarProps {
  /**
   * Re-reads whatever the screen is showing. Values arrive REDACTED from the server and only come
   * back decrypted on a request that carries the grant, so a reveal that does not re-fetch changes
   * nothing on screen — which reads to the member as a broken button.
   */
  onRefresh: () => void | Promise<void>;
  testID?: string;
}

/**
 * The reveal control for a screen showing protected values (ADP plan 7.2): the button and the
 * re-fetch. The OTP prompt it may trigger is mounted once at the app shell, so adding this to a
 * screen costs it no modal.
 *
 * Renders nothing at all when the department is not protected, so a screen can include it
 * unconditionally and departments without the addon never see it.
 *
 * When the department has exempted this app from the prompt (plan 3.3) the grant arrives silently
 * and the values simply appear. The screen does not know or care which happened.
 */
export const ProtectedRevealBar: React.FC<ProtectedRevealBarProps> = ({ onRefresh, testID }) => {
  const { t } = useTranslation();
  const isProtectionEnabled = useIsProtectionEnabled();

  // The re-read is fire-and-forget from the bar's point of view, but a failure is still a failure:
  // after a conceal it means the plaintext is still on screen, so it is logged rather than dropped.
  const refresh = useCallback(
    (reason: 'revealed' | 'concealed' | 'expired') => {
      Promise.resolve()
        .then(() => onRefresh())
        .catch((error: unknown) => {
          logger.error({
            message: 'Protected data refresh failed',
            context: { op: 'protected_reveal_refresh', reason, testID: testID ?? 'protected-reveal-bar', error: error instanceof Error ? error.message : String(error) },
          });
        });
    },
    [onRefresh, testID]
  );

  const handleRevealed = useCallback(() => {
    refresh('revealed');
  }, [refresh]);

  const { isRevealed, isRequesting, reveal, conceal } = useProtectedReveal(handleRevealed);

  const concealedManually = useRef(false);
  const handleConceal = useCallback(() => {
    concealedManually.current = true;
    conceal();
    // Re-read without the grant so the plaintext leaves memory as well as the screen. Clearing the
    // grant alone would leave the values already rendered sitting there until the next navigation.
    refresh('concealed');
  }, [conceal, refresh]);

  // The window is absolute: when the store's expiry timer drops the grant while this screen sits
  // open, isRevealed flips on its own and nothing else re-reads. The same re-read a manual conceal
  // does happens here, so the plaintext leaves the screen at expiry too. A manual conceal already
  // refreshed, so it is skipped; so is sign-out, where the screen is on its way out anyway.
  const wasRevealed = useRef(isRevealed);
  useEffect(() => {
    if (wasRevealed.current && !isRevealed && !concealedManually.current && useAuthStore.getState().status === 'signedIn') {
      refresh('expired');
    }
    concealedManually.current = false;
    wasRevealed.current = isRevealed;
  }, [isRevealed, refresh]);

  if (!isProtectionEnabled) {
    return null;
  }

  return (
    <HStack space="sm" className="items-center px-4 py-2" testID={testID ?? 'protected-reveal-bar'}>
      <ShieldIcon size={16} />
      <Text size="sm" className="flex-1">
        {isRevealed ? t('data_protection.revealed_notice', 'Protected information is visible.') : t('data_protection.protected_notice', 'Some information on this screen is protected.')}
      </Text>
      {isRevealed ? (
        <Button size="sm" variant="outline" action="secondary" onPress={handleConceal} testID="protected-conceal-button">
          <ButtonIcon as={EyeOffIcon} />
          <ButtonText>{t('data_protection.conceal', 'Hide again')}</ButtonText>
        </Button>
      ) : (
        <Button size="sm" action="primary" onPress={reveal} isDisabled={isRequesting} testID="protected-reveal-button">
          {isRequesting ? (
            <Spinner size="small" />
          ) : (
            <>
              <ButtonIcon as={EyeIcon} />
              <ButtonText>{t('data_protection.reveal', 'Show protected information')}</ButtonText>
            </>
          )}
        </Button>
      )}
    </HStack>
  );
};
