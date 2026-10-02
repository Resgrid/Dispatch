import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApprovalPanel } from '@/components/mfa/approval-panel';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { mfaErrorKey } from '@/lib/mfa/messages';
import { passkeysSupported } from '@/lib/mfa/passkey';
import type { MfaMethod, TotpSetupData } from '@/lib/mfa/types';
import useAuthStore from '@/stores/auth/store';

interface LoginMfaSheetProps {
  isOpen: boolean;
  /** "I lost my authenticator": start the restricted recovery with a recovery code. */
  onLostFactor: () => void;
}

type Mode = 'choose' | 'recovery';

/**
 * The second step of signing in on a login transaction (passkey plan section 7.5): the methods this sign-in accepts, as
 * equal choices with the member's last one first. It also carries setting up the authenticator a department requires
 * (section 6.2). Codes live only in local state and are cleared after every attempt; nothing here is logged or stored.
 */
export const LoginMfaSheet: React.FC<LoginMfaSheetProps> = ({ isOpen, onLostFactor }) => {
  const { t } = useTranslation();
  const challenge = useAuthStore((s) => s.mfaChallenge);
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [approval, setApproval] = useState<{ id: string; number: string } | null>(null);
  const [setup, setSetup] = useState<TotpSetupData | null>(null);
  const approvalAbort = useRef<AbortController | null>(null);

  const isSetup = challenge?.kind === 'setup';
  const methods = useMemo<MfaMethod[]>(() => {
    // The accepted methods the member has (plan section 7.5, as Core Web shows them): the server lists the two apart, and a
    // method the member lacks could only fail. A server that sends no member list keeps the full one.
    const enrolled = challenge?.enrolled ?? [];
    const usable = (challenge?.methods ?? []).filter((m) => enrolled.length === 0 || enrolled.includes(m));
    const available = usable.filter((m) => m !== 'passkey' || passkeysSupported());
    const preferred = challenge?.preferred;
    return preferred && available.includes(preferred) ? [preferred, ...available.filter((m) => m !== preferred)] : available;
  }, [challenge]);
  const recoveryAvailable = !isSetup && (challenge?.enrolled ?? []).includes('totp');

  const stopApproval = useCallback(() => {
    approvalAbort.current?.abort();
    approvalAbort.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopApproval();
      setMode('choose');
      setCode('');
      setErrorCode(null);
      setApproval(null);
      setSetup(null);
      setBusy(false);
    }
  }, [isOpen, stopApproval]);

  useEffect(() => stopApproval, [stopApproval]);

  // Setting up the required authenticator: a new key, activated only when a code from it verifies.
  useEffect(() => {
    if (!isOpen || !isSetup || setup) {
      return;
    }
    let cancelled = false;
    void useAuthStore
      .getState()
      .loginSetupOptions()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if ('SharedKey' in result) {
          setSetup(result);
        } else {
          setErrorCode(result.code);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isSetup, setup]);

  const run = useCallback(async (action: () => Promise<{ ok: boolean; code?: string }>) => {
    setBusy(true);
    setErrorCode(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setErrorCode(result.code ?? 'unknown_error');
    }
  }, []);

  const submitCode = useCallback(() => {
    const submitted = code.trim();
    if (submitted.length === 0) {
      return;
    }
    setCode('');
    const method = isSetup ? 'setup' : mode === 'recovery' ? 'recovery_code' : 'totp';
    void run(async () => {
      const result = await useAuthStore.getState().verifyLoginMfa({ method, code: submitted });
      return result.ok ? { ok: true } : { ok: false, code: result.code };
    });
  }, [code, isSetup, mode, run]);

  const verifyWithPasskey = useCallback(() => {
    void run(async () => {
      const result = await useAuthStore.getState().verifyLoginMfa({ method: 'passkey' });
      return result.ok ? { ok: true } : { ok: false, code: result.code };
    });
  }, [run]);

  const verifyWithProvider = useCallback(() => {
    void run(async () => {
      const result = await useAuthStore.getState().verifyLoginMfa({ method: 'federated' });
      return result.ok ? { ok: true } : { ok: false, code: result.code };
    });
  }, [run]);

  const verifyWithApproval = useCallback(async () => {
    setBusy(true);
    setErrorCode(null);
    const store = useAuthStore.getState();
    const started = await store.requestLoginApproval();
    if (!('ApprovalRequestId' in started)) {
      setBusy(false);
      setErrorCode(started.code);
      return;
    }

    setApproval({ id: started.ApprovalRequestId, number: started.MatchNumber });
    const controller = new AbortController();
    approvalAbort.current = controller;
    const decided = await store.waitForLoginApproval(started.ApprovalRequestId, controller.signal);
    if (decided === 'aborted') {
      return;
    }
    setApproval(null);
    if (decided !== 'approved') {
      setBusy(false);
      setErrorCode(decided === 'denied' ? 'approval_denied' : decided === 'unavailable' ? 'service_unavailable' : 'approval_expired');
      return;
    }
    const result = await store.verifyLoginMfa({ method: 'passkey_approval', approvalRequestId: started.ApprovalRequestId });
    setBusy(false);
    if (!result.ok) {
      setErrorCode(result.code);
    }
  }, []);

  const cancelApproval = useCallback(() => {
    const current = approval;
    stopApproval();
    setApproval(null);
    setBusy(false);
    if (current) {
      void useAuthStore.getState().cancelLoginApproval(current.id);
    }
  }, [approval, stopApproval]);

  const cancelSignIn = useCallback(() => {
    cancelApproval();
    useAuthStore.getState().cancelLoginMfa();
  }, [cancelApproval]);

  const showsCodeInput = isSetup ? !!setup : mode === 'recovery' || methods.includes('totp');

  return (
    <Modal isOpen={isOpen} onClose={cancelSignIn} testID="login-mfa-sheet">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{isSetup ? t('mfa.setup.title') : t('mfa.login.title')}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text size="sm">{isSetup ? t('mfa.setup.body') : mode === 'recovery' ? t('mfa.login.recovery_body') : t('mfa.login.body')}</Text>

            {isSetup && setup ? (
              <VStack space="sm" testID="mfa-setup-key">
                <Text size="sm" className="font-semibold">
                  {t('mfa.setup.key_label')}
                </Text>
                <Text selectable className="font-mono text-lg" testID="mfa-setup-shared-key">
                  {setup.SharedKey}
                </Text>
                <Button variant="outline" action="secondary" size="sm" onPress={() => void Linking.openURL(setup.AuthenticatorUri)} testID="mfa-setup-open-app">
                  <ButtonText>{t('mfa.setup.open_app')}</ButtonText>
                </Button>
              </VStack>
            ) : null}

            {approval ? <ApprovalPanel matchNumber={approval.number} onCancel={cancelApproval} /> : null}

            {!approval && showsCodeInput ? (
              <Input variant="outline" size="lg" isDisabled={busy}>
                <InputField
                  testID="login-mfa-code"
                  value={code}
                  onChangeText={setCode}
                  placeholder={mode === 'recovery' ? t('mfa.login.recovery_placeholder') : t('mfa.login.code_placeholder')}
                  keyboardType={mode === 'recovery' ? 'default' : 'number-pad'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={mode === 'recovery' ? 32 : 8}
                  autoComplete={mode === 'recovery' ? 'off' : 'one-time-code'}
                  textContentType={mode === 'recovery' ? 'none' : 'oneTimeCode'}
                  onSubmitEditing={submitCode}
                  accessibilityLabel={mode === 'recovery' ? t('mfa.login.recovery_placeholder') : t('mfa.login.code_placeholder')}
                  aria-label={mode === 'recovery' ? t('mfa.login.recovery_placeholder') : t('mfa.login.code_placeholder')}
                />
              </Input>
            ) : null}

            {!approval && showsCodeInput ? (
              <Button action="primary" onPress={submitCode} isDisabled={busy || code.trim().length === 0} testID="login-mfa-submit">
                {busy ? <Spinner size="small" /> : <ButtonText>{t('mfa.login.verify')}</ButtonText>}
              </Button>
            ) : null}

            {!approval && !isSetup && mode === 'choose' && methods.includes('passkey') ? (
              <Button variant="outline" action="secondary" onPress={verifyWithPasskey} isDisabled={busy} testID="login-mfa-passkey">
                <ButtonText>{t('mfa.login.use_passkey')}</ButtonText>
              </Button>
            ) : null}
            {!approval && !isSetup && mode === 'choose' && methods.includes('passkey_approval') ? (
              <Button variant="outline" action="secondary" onPress={() => void verifyWithApproval()} isDisabled={busy} testID="login-mfa-approval">
                <ButtonText>{t('mfa.login.use_approval')}</ButtonText>
              </Button>
            ) : null}
            {!approval && !isSetup && mode === 'choose' && methods.includes('federated') ? (
              <Button variant="outline" action="secondary" onPress={verifyWithProvider} isDisabled={busy} testID="login-mfa-provider">
                <ButtonText>{t('mfa.login.use_provider')}</ButtonText>
              </Button>
            ) : null}

            {errorCode ? (
              <Text size="sm" className="text-error-600" testID="login-mfa-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
                {t(mfaErrorKey(errorCode))}
              </Text>
            ) : null}

            {!approval && recoveryAvailable ? (
              <Pressable onPress={() => setMode(mode === 'recovery' ? 'choose' : 'recovery')} testID="login-mfa-recovery-toggle" accessibilityRole="button">
                <Text size="sm" className="text-primary-600">
                  {mode === 'recovery' ? t('mfa.login.use_other_method') : t('mfa.login.use_recovery_code')}
                </Text>
              </Pressable>
            ) : null}
            {!approval && !isSetup ? (
              <Pressable onPress={onLostFactor} testID="login-mfa-lost" accessibilityRole="button">
                <Text size="sm" className="text-primary-600">
                  {t('mfa.login.lost_factor')}
                </Text>
              </Pressable>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={cancelSignIn} isDisabled={busy && !approval} testID="login-mfa-cancel">
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
