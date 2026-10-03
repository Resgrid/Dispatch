import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView } from 'react-native';

import {
  beginUnlockSso,
  cancelUnlockApproval,
  completeUnlock,
  type CompleteUnlockInput,
  getCurrentSession,
  getUnlockApprovalStatus,
  getUnlockOptions,
  lockSession,
  requestUnlockApproval,
  type UnlockOptionsData,
} from '@/api/mfa/shared-session';
import { ApprovalPanel } from '@/components/mfa/approval-panel';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Lock } from '@/components/ui/lucide-icons';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { waitForApproval } from '@/lib/mfa/approval-wait';
import { toMfaProblem } from '@/lib/mfa/errors';
import { mfaErrorKey } from '@/lib/mfa/messages';
import { getPasskeyAssertion, passkeysSupported } from '@/lib/mfa/passkey';
import { isPasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';
import { afterSharedUnlock, endSharedShift } from '@/lib/shared-session/controller';
import useAuthStore from '@/stores/auth/store';
import { applySharedSessionStatus, markSharedSessionLocked, resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

type Phase = 'loading' | 'ready' | 'unavailable';

/**
 * The shared lock screen (passkey plan section 10.5), over everything while the server says this session is
 * locked. The locked operator unlocks the same session with their own second factor; anyone can end the shift or hand
 * the vehicle to the next operator. It asks the server to lock first (idempotent there), so a lock that never reached the
 * server cannot be skipped, and it never starts a passkey prompt on its own.
 */
export const SharedSessionLockScreen: React.FC = () => {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const locked = useSharedSessionStore((s) => s.locked);
  const visible = signedIn && locked;

  const [phase, setPhase] = useState<Phase>('loading');
  const [options, setOptions] = useState<UnlockOptionsData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [approval, setApproval] = useState<{ id: string; number: string } | null>(null);
  const approvalAbort = useRef<AbortController | null>(null);

  const stopApproval = useCallback(() => {
    approvalAbort.current?.abort();
    approvalAbort.current = null;
  }, []);

  /** Refusals that mean the session itself is gone, or was never shared: nothing is left to unlock here. */
  const ended = useCallback(async (problemCode: string): Promise<boolean> => {
    if (problemCode === 'session_revoked' || problemCode === 'session_required') {
      await useAuthStore.getState().logout();
      return true;
    }
    if (problemCode === 'not_shared_session') {
      resetSharedSession();
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    stopApproval();
    setApproval(null);
    setPhase('loading');
    setCode('');
    try {
      const lock = await lockSession();
      markSharedSessionLocked(lock.LockVersion);
      const unlock = await getUnlockOptions(lock.LockVersion);
      setOptions(unlock);
      setPhase('ready');
    } catch (error) {
      const problem = toMfaProblem(error).code;
      if (await ended(problem)) {
        return;
      }
      setErrorCode(problem);
      setPhase('unavailable');
    }
  }, [ended, stopApproval]);

  useEffect(() => {
    if (visible) {
      setErrorCode(null);
      void load();
    } else {
      stopApproval();
      setOptions(null);
      setApproval(null);
      setCode('');
    }
  }, [visible, load, stopApproval]);

  useEffect(() => stopApproval, [stopApproval]);

  const unlock = useCallback(
    async (input: () => Promise<CompleteUnlockInput | null>) => {
      if (!options) {
        return;
      }
      setBusy(true);
      setErrorCode(null);
      try {
        const proof = await input();
        if (!proof) {
          return;
        }
        const session = await completeUnlock(options.LockVersion, proof);
        applySharedSessionStatus(session);
        await afterSharedUnlock();
      } catch (error) {
        const problem = isPasskeyCeremonyError(error) ? `passkey_${error.reason}` : toMfaProblem(error).code;
        if (await ended(problem)) {
          return;
        }
        setErrorCode(problem);
        if (problem === 'shared_session_lock_changed') {
          // Locked again since the options came: start over on the current lock.
          await load();
          setErrorCode(problem);
        } else if (problem === 'shared_session_not_locked') {
          // Already unlocked (a second tap that crossed the first): follow the server.
          const session = await getCurrentSession().catch(() => null);
          if (session && !session.Locked) {
            applySharedSessionStatus(session);
            await afterSharedUnlock();
          } else {
            await load();
          }
        } else if (needsNewCeremony(problem)) {
          // A passkey ceremony is single-use; the next attempt needs a fresh one.
          setOptions(await getUnlockOptions(options.LockVersion).catch(() => options));
        }
      } finally {
        setCode('');
        setBusy(false);
      }
    },
    [ended, load, options]
  );

  const unlockWithCode = () => void unlock(async () => ({ Method: 'totp', Code: code.trim() }));

  const unlockWithPasskey = () =>
    void unlock(async () => {
      const ceremony = options?.Passkey;
      if (!ceremony) {
        throw Object.assign(new Error('passkey'), { response: { status: 400, data: { type: 'passkeys_unavailable' } } });
      }
      const credential = await getPasskeyAssertion(ceremony.Options);
      return { Method: 'passkey', RequestId: ceremony.RequestId, Credential: credential };
    });

  const unlockWithProvider = () =>
    void unlock(async () => {
      if (!options) {
        return null;
      }
      // Always a fresh provider sign-in on a shared device: no cookies are kept for the next operator.
      const trip = await runSsoRoundTrip((secrets) => beginUnlockSso(options.LockVersion, secrets), true);
      if (!trip.ok) {
        throw Object.assign(new Error('sso'), { response: { status: 400, data: { type: trip.code ?? `sso_${trip.reason}` } } });
      }
      return { Method: 'federated', SsoTransactionId: trip.trip.ssoTransactionId, SsoCode: trip.trip.ssoCode, CodeVerifier: trip.trip.codeVerifier };
    });

  const unlockWithApproval = async () => {
    if (!options) {
      return;
    }
    setErrorCode(null);
    setBusy(true);
    let started: { ApprovalRequestId: string; MatchNumber: string };
    try {
      started = await requestUnlockApproval(options.LockVersion);
    } catch (error) {
      setErrorCode(toMfaProblem(error).code);
      setBusy(false);
      return;
    }
    setBusy(false);
    setApproval({ id: started.ApprovalRequestId, number: started.MatchNumber });
    const abort = new AbortController();
    approvalAbort.current = abort;
    const result = await waitForApproval(() => getUnlockApprovalStatus(started.ApprovalRequestId), abort.signal);
    if (abort.signal.aborted) {
      return;
    }
    approvalAbort.current = null;
    setApproval(null);
    if (result === 'approved') {
      await unlock(async () => ({ Method: 'passkey_approval', ApprovalRequestId: started.ApprovalRequestId }));
    } else if (result === 'denied') {
      setErrorCode('approval_denied');
    } else if (result === 'canceled') {
      // The session locked again while waiting: the request belonged to the earlier lock.
      await load();
    } else {
      setErrorCode(result === 'unavailable' ? 'network_error' : 'approval_expired');
    }
  };

  const cancelApproval = () => {
    const pending = approval;
    stopApproval();
    setApproval(null);
    if (pending) {
      void cancelUnlockApproval(pending.id).catch(() => undefined);
    }
  };

  const finishShift = (switchOperator: boolean) => {
    cancelApproval();
    setBusy(true);
    void endSharedShift(switchOperator).finally(() => setBusy(false));
  };

  const methods = options?.Methods ?? [];
  const offersCode = methods.includes('totp');
  const offersPasskey = methods.includes('passkey') && !!options?.Passkey && passkeysSupported();
  const offersApproval = methods.includes('passkey_approval');
  const offersProvider = methods.includes('federated');

  return (
    <Modal visible={visible} animationType="none" transparent={false} onRequestClose={() => undefined} testID="shared-lock-screen">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Box className="w-full max-w-lg self-center">
          <VStack space="md">
            <VStack space="xs" className="items-center">
              <Lock size={40} />
              <Heading size="lg" className="text-center">
                {t('shared_session.locked_title')}
              </Heading>
              {options?.Operator ? (
                <Text className="text-center" testID="shared-lock-operator">
                  {t('shared_session.locked_operator', { operator: options.Operator })}
                </Text>
              ) : null}
            </VStack>

            {phase === 'loading' ? <Spinner size="large" /> : null}

            {phase === 'ready' && !approval ? (
              <>
                {methods.length === 0 ? (
                  <Text size="sm" className="text-center" testID="shared-lock-no-methods">
                    {t('shared_session.no_unlock')}
                  </Text>
                ) : (
                  <Text size="sm" className="text-center">
                    {t('shared_session.locked_body')}
                  </Text>
                )}
                {offersCode ? (
                  <>
                    <Input variant="outline" size="lg" isDisabled={busy}>
                      <InputField
                        testID="shared-lock-code"
                        value={code}
                        onChangeText={setCode}
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder={t('mfa.login.code_placeholder')}
                        aria-label={t('mfa.login.code_placeholder')}
                      />
                    </Input>
                    <Button action="primary" onPress={unlockWithCode} isDisabled={busy || code.trim().length === 0} testID="shared-lock-unlock">
                      {busy ? <Spinner size="small" /> : <ButtonText>{t('shared_session.unlock')}</ButtonText>}
                    </Button>
                  </>
                ) : null}
                {offersPasskey ? (
                  <Button variant="outline" action="secondary" onPress={unlockWithPasskey} isDisabled={busy} testID="shared-lock-passkey">
                    <ButtonText>{t('mfa.login.use_passkey')}</ButtonText>
                  </Button>
                ) : null}
                {offersApproval ? (
                  <Button variant="outline" action="secondary" onPress={() => void unlockWithApproval()} isDisabled={busy} testID="shared-lock-approval">
                    <ButtonText>{t('mfa.login.use_approval')}</ButtonText>
                  </Button>
                ) : null}
                {offersProvider ? (
                  <Button variant="outline" action="secondary" onPress={unlockWithProvider} isDisabled={busy} testID="shared-lock-provider">
                    <ButtonText>{t('mfa.login.use_provider')}</ButtonText>
                  </Button>
                ) : null}
              </>
            ) : null}

            {approval ? <ApprovalPanel matchNumber={approval.number} onCancel={cancelApproval} /> : null}

            {phase === 'unavailable' ? (
              <Button variant="outline" action="secondary" onPress={() => void load()} isDisabled={busy} testID="shared-lock-retry">
                <ButtonText>{t('shared_session.retry')}</ButtonText>
              </Button>
            ) : null}

            {errorCode ? (
              <Text size="sm" className="text-center text-error-600" testID="shared-lock-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
                {t(mfaErrorKey(errorCode))}
              </Text>
            ) : null}

            <VStack space="sm" className="mt-4">
              <Button variant="outline" action="secondary" onPress={() => finishShift(true)} isDisabled={busy} testID="shared-lock-switch">
                <ButtonText>{t('shared_session.switch_operator')}</ButtonText>
              </Button>
              <Button variant="outline" action="negative" onPress={() => finishShift(false)} isDisabled={busy} testID="shared-lock-end-shift">
                <ButtonText>{t('shared_session.end_shift')}</ButtonText>
              </Button>
            </VStack>
          </VStack>
        </Box>
      </ScrollView>
    </Modal>
  );
};

/** Passkey refusals after which the server has spent the ceremony. */
const needsNewCeremony = (problem: string): boolean => problem.startsWith('passkey_') || problem === 'challenge_consumed' || problem === 'challenge_expired';
