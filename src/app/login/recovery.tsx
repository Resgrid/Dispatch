import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { RecoveryCodes } from '@/components/mfa/recovery-codes';
import { FocusAwareStatusBar } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Checkbox, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { mfaErrorKey } from '@/lib/mfa/messages';
import type { PasskeyData, TotpSetupData } from '@/lib/mfa/types';
import { abandonFactorRecovery, finishFactorRecovery, hasLoginTransaction, recoveryReplacementKey } from '@/stores/auth/login-mfa';
import useAuthStore from '@/stores/auth/store';

type Step = 'code' | 'replace' | 'done' | 'help';

/**
 * "I lost my authenticator" (passkey plan sections 5.4 and 6.3). A recovery code, after the password or single sign-on,
 * opens a restricted recovery: a new authenticator is staged and activated only when a code from it verifies, lost
 * passkeys can be removed, and every session ends. Without a recovery code the page says who can help; nothing here
 * waives MFA.
 */
export default function FactorRecovery() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => (hasLoginTransaction() ? 'code' : 'help'));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyData[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [key, setKey] = useState<TotpSetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    if (step !== 'replace' || key) {
      return;
    }
    void recoveryReplacementKey().then((result) => ('SharedKey' in result ? setKey(result) : setErrorCode(result.code)));
  }, [step, key]);

  const begin = useCallback(async () => {
    setBusy(true);
    setErrorCode(null);
    const started = await useAuthStore.getState().beginFactorRecovery(code);
    setBusy(false);
    setCode('');
    if ('passkeys' in started) {
      setPasskeys(started.passkeys);
      setStep('replace');
    } else if (started.restart) {
      setStep('help');
      setErrorCode(started.code);
    } else {
      setErrorCode(started.code);
    }
  }, [code]);

  const finish = useCallback(async () => {
    setBusy(true);
    setErrorCode(null);
    const done = await finishFactorRecovery(code, remove);
    setBusy(false);
    setCode('');
    if ('recoveryCodes' in done) {
      setRecoveryCodes(done.recoveryCodes);
      setStep('done');
    } else {
      setErrorCode(done.code);
      if (done.ended) {
        setStep('help');
      }
    }
  }, [code, remove]);

  const cancel = useCallback(async () => {
    await abandonFactorRecovery();
    router.replace('/login');
  }, [router]);

  const togglePasskey = (id: string) => setRemove((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: t('mfa.recovery.title') }} />
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack space="md">
          <Heading size="md">{t('mfa.recovery.title')}</Heading>

          {step === 'code' ? (
            <>
              <Text size="sm">{t('mfa.recovery.code_body')}</Text>
              <Input variant="outline" size="lg" isDisabled={busy}>
                <InputField
                  testID="recovery-code-input"
                  value={code}
                  onChangeText={setCode}
                  placeholder={t('mfa.login.recovery_placeholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  aria-label={t('mfa.login.recovery_placeholder')}
                />
              </Input>
              <Button action="primary" onPress={() => void begin()} isDisabled={busy || code.trim().length === 0} testID="recovery-begin">
                {busy ? <Spinner size="small" /> : <ButtonText>{t('mfa.recovery.begin')}</ButtonText>}
              </Button>
              <Button variant="link" action="secondary" onPress={() => setStep('help')} testID="recovery-no-code">
                <ButtonText>{t('mfa.recovery.no_code')}</ButtonText>
              </Button>
            </>
          ) : null}

          {step === 'replace' ? (
            <>
              <Text size="sm">{t('mfa.recovery.replace_body')}</Text>
              {key ? (
                <VStack space="sm">
                  <Text selectable className="font-mono text-lg" testID="recovery-shared-key">
                    {key.SharedKey}
                  </Text>
                  <Button variant="outline" action="secondary" size="sm" onPress={() => void Linking.openURL(key.AuthenticatorUri)}>
                    <ButtonText>{t('mfa.setup.open_app')}</ButtonText>
                  </Button>
                </VStack>
              ) : (
                <Spinner size="small" />
              )}
              {passkeys.length > 0 ? (
                <VStack space="xs" testID="recovery-passkeys">
                  <Text size="sm" className="font-semibold">
                    {t('mfa.recovery.remove_passkeys')}
                  </Text>
                  {passkeys.map((passkey) => (
                    <Checkbox
                      key={passkey.PasskeyId}
                      value={passkey.PasskeyId}
                      isChecked={remove.includes(passkey.PasskeyId)}
                      onChange={() => togglePasskey(passkey.PasskeyId)}
                      testID={`recovery-passkey-${passkey.PasskeyId}`}
                    >
                      <CheckboxIndicator />
                      <CheckboxLabel>{passkey.DisplayName}</CheckboxLabel>
                    </Checkbox>
                  ))}
                </VStack>
              ) : null}
              <Input variant="outline" size="lg" isDisabled={busy}>
                <InputField
                  testID="recovery-new-code"
                  value={code}
                  onChangeText={setCode}
                  placeholder={t('mfa.login.code_placeholder')}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  aria-label={t('mfa.login.code_placeholder')}
                />
              </Input>
              <Button action="primary" onPress={() => void finish()} isDisabled={busy || !key || code.trim().length === 0} testID="recovery-finish">
                {busy ? <Spinner size="small" /> : <ButtonText>{t('mfa.recovery.finish')}</ButtonText>}
              </Button>
              <Button variant="outline" action="secondary" onPress={() => void cancel()} isDisabled={busy} testID="recovery-cancel">
                <ButtonText>{t('mfa.recovery.cancel')}</ButtonText>
              </Button>
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <Text size="sm">{t('mfa.recovery.done_body')}</Text>
              <RecoveryCodes codes={recoveryCodes} />
              <Button action="primary" onPress={() => router.replace('/login')} testID="recovery-sign-in">
                <ButtonText>{t('mfa.recovery.sign_in')}</ButtonText>
              </Button>
            </>
          ) : null}

          {step === 'help' ? (
            <>
              <Text size="sm">{t('mfa.recovery.help_body')}</Text>
              <Button action="primary" onPress={() => router.replace('/login')} testID="recovery-back">
                <ButtonText>{t('mfa.recovery.back_to_sign_in')}</ButtonText>
              </Button>
            </>
          ) : null}

          {errorCode ? (
            <Text size="sm" className="text-error-600" testID="recovery-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
              {t(mfaErrorKey(errorCode))}
            </Text>
          ) : null}
        </VStack>
      </ScrollView>
    </>
  );
}
