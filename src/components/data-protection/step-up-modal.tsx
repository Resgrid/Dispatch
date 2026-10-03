import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApprovalPanel } from '@/components/mfa/approval-panel';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { mfaErrorKey } from '@/lib/mfa/messages';
import { dataProtectionStore } from '@/stores/data-protection/store';

interface StepUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Invoked after a successful verification, before the modal closes. */
  onVerified?: () => void;
}

/**
 * Advanced Data Protection step-up prompt: collects the user's current authenticator (TOTP)
 * code and exchanges it for an absolute step-up window. Shown before revealing or editing a
 * protected field. The code lives only in local component state and is cleared on every
 * close/submit; it is never logged or persisted.
 */
export const StepUpModal: React.FC<StepUpModalProps> = ({ isOpen, onClose, onVerified }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const isVerifying = dataProtectionStore((state) => state.isVerifying);
  const lastError = dataProtectionStore((state) => state.lastError);
  const methods = dataProtectionStore((state) => state.stepUpMethods);
  const [approval, setApproval] = useState<{ id: string; number: string } | null>(null);
  const approvalAbort = useRef<AbortController | null>(null);

  // The methods this member has and the department accepts for protected data (passkey plan section 8.1).
  useEffect(() => {
    if (isOpen) {
      void dataProtectionStore.getState().loadStepUpMethods();
    } else {
      setCode('');
      approvalAbort.current?.abort();
      approvalAbort.current = null;
      setApproval(null);
    }
  }, [isOpen]);

  const finished = useCallback(
    (ok: boolean) => {
      if (ok) {
        onVerified?.();
        onClose();
      }
    },
    [onClose, onVerified]
  );

  const handlePasskey = useCallback(async () => finished(await dataProtectionStore.getState().verifyPasskey()), [finished]);

  const handleProvider = useCallback(async () => finished(await dataProtectionStore.getState().verifyFederated()), [finished]);

  const handleApproval = useCallback(async () => {
    const store = dataProtectionStore.getState();
    const started = await store.requestApproval();
    if (!started) {
      return;
    }
    setApproval(started);
    const controller = new AbortController();
    approvalAbort.current = controller;
    const decided = await store.waitForApproval(started.id, controller.signal);
    if (decided === 'aborted') {
      return;
    }
    setApproval(null);
    if (decided !== 'approved') {
      dataProtectionStore.setState({ lastError: decided === 'denied' ? 'approval_denied' : 'approval_expired' });
      return;
    }
    finished(await store.completeApproval(started.id));
  }, [finished]);

  const cancelApproval = useCallback(() => {
    const current = approval;
    approvalAbort.current?.abort();
    approvalAbort.current = null;
    setApproval(null);
    if (current) {
      void dataProtectionStore.getState().cancelApproval(current.id);
    }
  }, [approval]);

  const offersCode = methods == null || methods.includes('totp');

  const handleVerify = useCallback(async () => {
    const submitted = code.trim();
    if (submitted.length === 0) {
      return;
    }

    const ok = await dataProtectionStore.getState().verifyOtp(submitted);
    setCode('');
    if (ok) {
      onVerified?.();
      onClose();
    }
  }, [code, onClose, onVerified]);

  const errorText = (() => {
    switch (lastError) {
      case 'invalid_totp':
        return t('data_protection.step_up_invalid_code', 'That code is invalid or has expired. Enter the current code from your authenticator app.');
      case 'mfa_not_enrolled':
        return t('data_protection.step_up_not_enrolled', 'Two-factor authentication is not set up for your account. Enroll an authenticator app in your account security settings first.');
      case 'too_many_attempts':
        return t('data_protection.step_up_too_many_attempts', 'Too many attempts. Wait a few minutes and try again.');
      case 'grants_not_configured':
        return t('data_protection.step_up_unavailable', 'Protected data is not available on this server yet. Contact your administrator.');
      case 'unknown':
        return t('data_protection.step_up_failed', 'Verification failed. Check your connection and try again.');
      case null:
      case undefined:
        return null;
      default:
        return t(mfaErrorKey(lastError));
    }
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} testID="step-up-modal">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{t('data_protection.step_up_title', 'Verify your identity')}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text size="sm">{t('data_protection.step_up_body', 'This information is protected. Enter the current code from your authenticator app to view it for a limited time.')}</Text>
            {approval ? <ApprovalPanel matchNumber={approval.number} onCancel={cancelApproval} /> : null}
            {!approval && offersCode ? (
              <Input variant="outline" size="lg" isDisabled={isVerifying}>
                <InputField
                  testID="step-up-code-input"
                  value={code}
                  onChangeText={setCode}
                  placeholder={t('data_protection.step_up_placeholder', '6-digit code')}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  onSubmitEditing={handleVerify}
                  // A placeholder is not a label: it is announced once and then disappears the
                  // moment the member types, leaving the field unnamed for the rest of the entry.
                  accessibilityLabel={t('data_protection.step_up_placeholder', '6-digit code')}
                  accessibilityHint={t('data_protection.step_up_body')}
                  aria-label={t('data_protection.step_up_placeholder', '6-digit code')}
                />
              </Input>
            ) : null}
            {!approval && methods?.includes('passkey') ? (
              <Button variant="outline" action="secondary" onPress={() => void handlePasskey()} isDisabled={isVerifying} testID="step-up-passkey">
                <ButtonText>{t('mfa.login.use_passkey')}</ButtonText>
              </Button>
            ) : null}
            {!approval && methods?.includes('passkey_approval') ? (
              <Button variant="outline" action="secondary" onPress={() => void handleApproval()} isDisabled={isVerifying} testID="step-up-approval">
                <ButtonText>{t('mfa.login.use_approval')}</ButtonText>
              </Button>
            ) : null}
            {!approval && methods?.includes('federated') ? (
              <Button variant="outline" action="secondary" onPress={() => void handleProvider()} isDisabled={isVerifying} testID="step-up-provider">
                <ButtonText>{t('mfa.login.use_provider')}</ButtonText>
              </Button>
            ) : null}
            {errorText ? (
              // Announced on appearance: the error arrives while focus is still in the field, so
              // a screen reader would otherwise never reach it.
              <Text size="sm" className="text-error-600" testID="step-up-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
                {errorText}
              </Text>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={onClose} isDisabled={isVerifying} testID="step-up-cancel">
            <ButtonText>{t('common.cancel', 'Cancel')}</ButtonText>
          </Button>
          {offersCode && !approval ? (
            <Button action="primary" onPress={handleVerify} isDisabled={isVerifying || code.trim().length === 0} testID="step-up-submit">
              {isVerifying ? <Spinner size="small" /> : <ButtonText>{t('data_protection.step_up_verify', 'Verify')}</ButtonText>}
            </Button>
          ) : null}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
