import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { beginSsoReauthentication, getStepUpOptions, reauthenticateWithPassword, redeemSsoReauthentication, type StepUpOptionsData, verifyStepUp } from '@/api/mfa/account-security';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { toMfaProblem } from '@/lib/mfa/errors';
import { mfaErrorKey } from '@/lib/mfa/messages';
import { getPasskeyAssertion, passkeysSupported } from '@/lib/mfa/passkey';
import { isPasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';

/** What the server asked for before a change: the first factor again, or a fresh second factor for account security. */
export type AccountProof = 'reauthenticate' | 'step_up';

interface AccountVerifyModalProps {
  proof: AccountProof | null;
  onDone: (verified: boolean) => void;
}

const STEP_UP_OPERATION = 'account_security';

/**
 * The fresh proof the server asks for before a sign-in method changes (passkey plan sections 6.2 and 7.6 row 14): the
 * password (or the department's identity provider, for a member who signs in there), or a code or passkey for this app.
 * Never approval or the provider's MFA for account changes. Secrets live only in local state.
 */
export const AccountVerifyModal: React.FC<AccountVerifyModalProps> = ({ proof, onDone }) => {
  const { t } = useTranslation();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [useProvider, setUseProvider] = useState(false);
  const [options, setOptions] = useState<StepUpOptionsData | null>(null);

  useEffect(() => {
    setSecret('');
    setErrorCode(null);
    setUseProvider(false);
    setOptions(null);
    if (proof === 'step_up') {
      void getStepUpOptions(STEP_UP_OPERATION)
        .then(setOptions)
        .catch((error: unknown) => setErrorCode(toMfaProblem(error).code));
    }
  }, [proof]);

  const attempt = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setErrorCode(null);
      try {
        await action();
        onDone(true);
      } catch (error) {
        const code = isPasskeyCeremonyError(error) ? `passkey_${error.reason}` : toMfaProblem(error).code;
        if (code === 'sso_reauthentication_required') {
          setUseProvider(true);
        }
        setErrorCode(code);
      } finally {
        setSecret('');
        setBusy(false);
      }
    },
    [onDone]
  );

  const submitPassword = () => void attempt(() => reauthenticateWithPassword(secret));

  const submitProvider = () =>
    void attempt(async () => {
      const trip = await runSsoRoundTrip((secrets) => beginSsoReauthentication(secrets));
      if (!trip.ok) {
        throw Object.assign(new Error('sso'), { response: { status: 400, data: { type: trip.code ?? `sso_${trip.reason}` } } });
      }
      await redeemSsoReauthentication(trip.trip.ssoTransactionId, trip.trip.ssoCode, trip.trip.codeVerifier);
    });

  const submitCode = () => void attempt(() => verifyStepUp({ Operation: STEP_UP_OPERATION, Method: 'totp', Code: secret.trim() }));

  const submitPasskey = () =>
    void attempt(async () => {
      // The ceremony the options started answers one attempt: whatever the outcome, a retry asks for a fresh one.
      const started = options?.Passkey ?? null;
      if (started) {
        setOptions((current) => (current ? { ...current, Passkey: null } : current));
      }
      const ceremony = started ?? (await getStepUpOptions(STEP_UP_OPERATION)).Passkey;
      if (!ceremony) {
        throw Object.assign(new Error('passkey'), { response: { status: 400, data: { type: 'passkeys_unavailable' } } });
      }
      const credential = await getPasskeyAssertion(ceremony.Options);
      await verifyStepUp({ Operation: STEP_UP_OPERATION, Method: 'passkey', RequestId: ceremony.RequestId, Credential: credential });
    });

  const reauth = proof === 'reauthenticate';
  const offersCode = !reauth && (options?.Methods ?? ['totp']).includes('totp');
  const offersPasskey = !reauth && (options?.Methods ?? []).includes('passkey') && passkeysSupported();

  return (
    <Modal isOpen={proof !== null} onClose={() => onDone(false)} testID="account-verify-modal">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{reauth ? t('mfa.account.reauth_title') : t('mfa.account.step_up_title')}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text size="sm">{reauth ? (useProvider ? t('mfa.account.reauth_provider_body') : t('mfa.account.reauth_body')) : t('mfa.account.step_up_body')}</Text>
            {(reauth && !useProvider) || offersCode ? (
              <Input variant="outline" size="lg" isDisabled={busy}>
                <InputField
                  testID="account-verify-secret"
                  value={secret}
                  onChangeText={setSecret}
                  secureTextEntry={reauth}
                  keyboardType={reauth ? 'default' : 'number-pad'}
                  autoCapitalize="none"
                  autoComplete={reauth ? 'current-password' : 'one-time-code'}
                  placeholder={reauth ? t('mfa.account.password_placeholder') : t('mfa.login.code_placeholder')}
                  aria-label={reauth ? t('mfa.account.password_placeholder') : t('mfa.login.code_placeholder')}
                />
              </Input>
            ) : null}
            {offersPasskey ? (
              <Button variant="outline" action="secondary" onPress={submitPasskey} isDisabled={busy} testID="account-verify-passkey">
                <ButtonText>{t('mfa.login.use_passkey')}</ButtonText>
              </Button>
            ) : null}
            {reauth && useProvider ? (
              <Button variant="outline" action="secondary" onPress={submitProvider} isDisabled={busy} testID="account-verify-provider">
                <ButtonText>{t('mfa.login.use_provider')}</ButtonText>
              </Button>
            ) : null}
            {errorCode ? (
              <Text size="sm" className="text-error-600" testID="account-verify-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
                {t(mfaErrorKey(errorCode))}
              </Text>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={() => onDone(false)} isDisabled={busy} testID="account-verify-cancel">
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          {(reauth && !useProvider) || offersCode ? (
            <Button action="primary" onPress={reauth ? submitPassword : submitCode} isDisabled={busy || secret.trim().length === 0} testID="account-verify-submit">
              {busy ? <Spinner size="small" /> : <ButtonText>{t('mfa.login.verify')}</ButtonText>}
            </Button>
          ) : null}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
