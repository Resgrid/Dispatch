import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
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

  useEffect(() => {
    if (!isOpen) {
      setCode('');
    }
  }, [isOpen]);

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
      default:
        return null;
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
          <Button action="primary" onPress={handleVerify} isDisabled={isVerifying || code.trim().length === 0} testID="step-up-submit">
            {isVerifying ? <Spinner size="small" /> : <ButtonText>{t('data_protection.step_up_verify', 'Verify')}</ButtonText>}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
