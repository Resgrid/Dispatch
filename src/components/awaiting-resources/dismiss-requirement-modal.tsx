import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** The server keeps up to 1000 characters of the note. */
const NOTE_MAX_LENGTH = 1000;

interface DismissRequirementModalProps {
  isOpen: boolean;
  /** What is awaited ("MUG"), named in the prompt so the dispatcher knows which requirement goes. */
  requirementLabel: string | null;
  isSubmitting: boolean;
  /** The optional note saying why the call no longer needs it (blank when none). */
  onConfirm: (note: string) => void;
  onClose: () => void;
}

/**
 * Confirms dismissing an outstanding requirement (conditional run cards) with an optional note. Dismissing takes the
 * call off the Awaiting Resources list for that requirement; nothing is dispatched or cancelled.
 */
export const DismissRequirementModal: React.FC<DismissRequirementModalProps> = ({ isOpen, requirementLabel, isSubmitting, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNote('');
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    onConfirm(note.trim());
  }, [note, onConfirm]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} testID="dismiss-requirement-modal">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{t('awaiting_resources.dismiss_title')}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text size="sm">{t('awaiting_resources.dismiss_confirm', { label: requirementLabel ?? '' })}</Text>
            <Input variant="outline" size="md" isDisabled={isSubmitting}>
              <InputField
                testID="dismiss-requirement-note"
                value={note}
                onChangeText={setNote}
                placeholder={t('awaiting_resources.dismiss_note_placeholder')}
                maxLength={NOTE_MAX_LENGTH}
                accessibilityLabel={t('awaiting_resources.dismiss_note_placeholder')}
                onSubmitEditing={handleConfirm}
              />
            </Input>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={onClose} isDisabled={isSubmitting} testID="dismiss-requirement-cancel">
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          <Button action="negative" onPress={handleConfirm} isDisabled={isSubmitting} testID="dismiss-requirement-confirm">
            {isSubmitting ? <Spinner size="small" /> : <ButtonText>{t('awaiting_resources.dismiss')}</ButtonText>}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
