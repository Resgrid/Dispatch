import { useCallback } from 'react';

import { dataProtectionStore, useHasGrantToken, useStepUpExpiresAt } from '@/stores/data-protection/store';

/**
 * The screen-facing half of an ADP reveal.
 *
 * A screen calls `reveal()`. If the department has exempted this app from the step-up prompt
 * (ADP plan 3.3) the grant arrives without any interaction and `isRevealed` flips straight to
 * true; otherwise the app's single OTP prompt opens and the reveal completes when the code is
 * accepted. The screen never decides which of those happens — the server does, per department and
 * per app, and this hook just reacts.
 *
 * The prompt itself is mounted once at the app shell, so a screen using this pulls in no modal.
 */
export const useProtectedReveal = (onRevealed?: () => void) => {
  const stepUpExpiresAt = useStepUpExpiresAt();
  const isRequesting = dataProtectionStore((state) => state.isRequestingGrant);

  const hasGrantToken = useHasGrantToken();

  // The token is part of the invariant, not just the expiry: without it the request goes out with
  // no grant header and the value comes back redacted, so a "revealed" screen would show nothing
  // new and reveal() would refuse to retry until the window lapsed.
  const isRevealed = hasGrantToken && stepUpExpiresAt != null && Date.now() < stepUpExpiresAt;

  const reveal = useCallback(async () => {
    const store = dataProtectionStore.getState();

    if (store.isStepUpActive()) {
      onRevealed?.();
      return;
    }

    const outcome = await store.ensureGrant();
    if (outcome === 'granted') {
      onRevealed?.();
      return;
    }

    // 'unavailable' prompts too: the modal is where the caller is told grants are not configured,
    // and silently doing nothing would look like a broken button.
    dataProtectionStore.getState().openPrompt();
  }, [onRevealed]);

  const conceal = useCallback(() => {
    dataProtectionStore.getState().clearStepUp();
  }, []);

  return { isRevealed, isRequesting, reveal, conceal };
};
