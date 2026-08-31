import React, { useCallback } from 'react';

import { StepUpModal } from '@/components/data-protection/step-up-modal';
import { dataProtectionStore, useIsStepUpPromptOpen } from '@/stores/data-protection/store';

/**
 * The app's ONE Advanced Data Protection prompt (ADP plan 7.2).
 *
 * Mounted at the authenticated shell so any screen can trigger it through the store without
 * carrying a modal of its own. One prompt per app also means two screens cannot stack two prompts
 * over each other, and the member always answers in the same place.
 */
export const StepUpPromptHost: React.FC = () => {
  const isOpen = useIsStepUpPromptOpen();

  const handleClose = useCallback(() => {
    dataProtectionStore.getState().closePrompt();
  }, []);

  return <StepUpModal isOpen={isOpen} onClose={handleClose} onVerified={handleClose} />;
};
