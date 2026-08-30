import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface LoginOtpModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** True when a previously submitted code was rejected. */
  invalidCode: boolean;
  onSubmit: (code: string) => void;
  onClose: () => void;
}

/**
 * Login two-factor prompt: collects the current authenticator (TOTP) code when the token
 * endpoint answers mfa_required / invalid_totp. Controlled component — the login screen owns
 * submission and retry. The code lives only in local state and is cleared on close/submit;
 * it is never logged or persisted.
 */
export const LoginOtpModal: React.FC<LoginOtpModalProps> = ({ isOpen, isSubmitting, invalidCode, onSubmit, onClose }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setCode('');
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    const submitted = code.trim();
    if (submitted.length === 0) {
      return;
    }
    setCode('');
    onSubmit(submitted);
  }, [code, onSubmit]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} testID="login-otp-modal">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{t('login.otp_title', 'Two-factor verification')}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text size="sm">{t('login.otp_body', 'Your account has two-factor authentication enabled. Enter the current code from your authenticator app to finish signing in.')}</Text>
            <Input variant="outline" size="lg" isDisabled={isSubmitting}>
              <InputField
                testID="login-otp-input"
                value={code}
                onChangeText={setCode}
                placeholder={t('login.otp_placeholder', '6-digit code')}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                onSubmitEditing={handleSubmit}
              />
            </Input>
            {invalidCode ? (
              <Text size="sm" className="text-error-600" testID="login-otp-error">
                {t('login.otp_invalid', 'That code is invalid or has expired. Enter the current code from your authenticator app.')}
              </Text>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={onClose} isDisabled={isSubmitting} testID="login-otp-cancel">
            <ButtonText>{t('common.cancel', 'Cancel')}</ButtonText>
          </Button>
          <Button action="primary" onPress={handleSubmit} isDisabled={isSubmitting || code.trim().length === 0} testID="login-otp-submit">
            {isSubmitting ? <Spinner size="small" /> : <ButtonText>{t('login.otp_verify', 'Verify')}</ButtonText>}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
