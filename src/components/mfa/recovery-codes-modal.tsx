import React from 'react';
import { useTranslation } from 'react-i18next';

import { RecoveryCodes } from '@/components/mfa/recovery-codes';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import useAuthStore from '@/stores/auth/store';

/**
 * After an authenticator was set up during sign-in (passkey plan section 6.2): the new recovery codes, once. Mounted at
 * the app shell so it shows on whatever screen the sign-in lands on.
 */
export const RecoveryCodesModal: React.FC = () => {
  const { t } = useTranslation();
  const codes = useAuthStore((s) => s.pendingRecoveryCodes);
  const dismiss = useAuthStore((s) => s.dismissRecoveryCodes);

  return (
    <Modal isOpen={!!codes && codes.length > 0} onClose={dismiss} testID="mfa-recovery-codes-modal">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{t('mfa.recovery_codes.title')}</Heading>
        </ModalHeader>
        <ModalBody>{codes ? <RecoveryCodes codes={codes} /> : null}</ModalBody>
        <ModalFooter>
          <Button action="primary" onPress={dismiss} testID="mfa-recovery-codes-done">
            <ButtonText>{t('mfa.recovery_codes.saved')}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
