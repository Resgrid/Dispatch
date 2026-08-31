import { create } from 'zustand';

import { getDataProtectionCapabilities, requestProtectedGrant, verifyStepUp } from '@/api/data-protection/data-protection';
import { setProtectedGrantProvider } from '@/lib/data-protection/grant-provider';
import { logger } from '@/lib/logging';

import useAuthStore from '../auth/store';

// ---------------------------------------------------------------------------
// Advanced Data Protection (ADP) grant state.
//
// DELIBERATELY NOT PERSISTED: the grant is a security credential and lives in
// memory only (ADP plan 7.2). App restart, logout or department switch always
// starts locked. The window is ABSOLUTE — activity never extends it.
// ---------------------------------------------------------------------------

export type StepUpErrorCode = 'invalid_totp' | 'mfa_not_enrolled' | 'too_many_attempts' | 'grants_not_configured' | 'unknown';

/** What ensureGrant() concluded. The caller shows the OTP prompt only for 'step_up_required'. */
export type GrantOutcome = 'granted' | 'step_up_required' | 'unavailable';

interface DataProtectionCapabilities {
  isProtectionEnabled: boolean;
  stepUpWindowMinutes: number;
  isDepartmentLocked: boolean;
  lockReason: string | null;
}

export interface DataProtectionState {
  capabilities: DataProtectionCapabilities | null;
  isCapabilitiesLoaded: boolean;
  /** Epoch ms the current window expires, or null when no grant is held. */
  stepUpExpiresAt: number | null;
  /** The signed grant. Memory only; never written to storage or logs. */
  grantToken: string | null;
  isVerifying: boolean;
  isRequestingGrant: boolean;
  /**
   * Whether the OTP prompt is showing. Held here rather than in a screen because the prompt is
   * mounted ONCE at the app shell: a modal per screen means several can stack, and it drags the
   * whole modal import graph into every screen that shows a protected value.
   */
  isPromptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
  lastError: StepUpErrorCode | null;
  fetchCapabilities: () => Promise<void>;
  /**
   * Tries to obtain a grant without prompting. Returns 'granted' when the department has exempted
   * this app, 'step_up_required' when the caller must enter a code, and 'unavailable' when grants
   * are not configured at all.
   *
   * Anything unexpected resolves to 'step_up_required'. Erring towards asking for a second factor
   * is the direction that cannot cause harm.
   */
  ensureGrant: () => Promise<GrantOutcome>;
  /** Sends the TOTP code; true on success. */
  verifyOtp: (code: string) => Promise<boolean>;
  /** True while an unexpired grant token is held. Evaluate at the moment of use. */
  isStepUpActive: () => boolean;
  /**
   * Headers for a request that needs to read protected values, or {} when no grant is held.
   * Spread into the request config: `{ headers: { ...getGrantHeaders() } }`.
   */
  getGrantHeaders: () => Record<string, string>;
  /** Drops the grant immediately (logout, department switch, manual conceal). */
  clearStepUp: () => void;
}

const GRANT_HEADER = 'X-Resgrid-Protected-Grant';

const parseErrorCode = (error: unknown): StepUpErrorCode => {
  const type = (error as { response?: { data?: { type?: string } } })?.response?.data?.type;
  if (type === 'invalid_totp' || type === 'mfa_not_enrolled' || type === 'too_many_attempts' || type === 'grants_not_configured') {
    return type;
  }
  return 'unknown';
};

const problemType = (error: unknown): string | undefined => (error as { response?: { data?: { type?: string } } })?.response?.data?.type;

export const dataProtectionStore = create<DataProtectionState>()((set, get) => ({
  capabilities: null,
  isCapabilitiesLoaded: false,
  stepUpExpiresAt: null,
  grantToken: null,
  isVerifying: false,
  isRequestingGrant: false,
  isPromptOpen: false,
  lastError: null,
  openPrompt: () => set({ isPromptOpen: true, lastError: null }),
  closePrompt: () => set({ isPromptOpen: false }),
  fetchCapabilities: async () => {
    try {
      const response = await getDataProtectionCapabilities();
      const data = response?.Data;
      set({
        capabilities: data
          ? {
              isProtectionEnabled: !!data.IsProtectionEnabled,
              stepUpWindowMinutes: data.StepUpWindowMinutes ?? 15,
              isDepartmentLocked: !!data.IsDepartmentLocked,
              lockReason: data.LockReason ?? null,
            }
          : null,
        isCapabilitiesLoaded: true,
      });
    } catch (error) {
      // Unknown capability state fails closed: consumers treat "no capabilities" as protected
      // when the server later marks fields redacted, and as unprotected for legacy departments.
      logger.error({
        message: 'Failed to fetch data protection capabilities',
        context: { error },
      });
      set({ isCapabilitiesLoaded: true });
    }
  },
  ensureGrant: async () => {
    if (get().isStepUpActive()) {
      return 'granted';
    }

    set({ isRequestingGrant: true, lastError: null });
    try {
      const result = await requestProtectedGrant();
      const expiresAt = result?.StepUpExpiresOnUtc ? Date.parse(result.StepUpExpiresOnUtc) : NaN;

      if (!result?.GrantToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        set({ isRequestingGrant: false });
        return 'step_up_required';
      }

      set({ grantToken: result.GrantToken, stepUpExpiresAt: expiresAt, isRequestingGrant: false, lastError: null });
      return 'granted';
    } catch (error) {
      set({ isRequestingGrant: false });

      const type = problemType(error);
      if (type === 'grants_not_configured') {
        return 'unavailable';
      }

      // Everything else — including a network failure — means prompt. The server refuses with
      // step_up_required whenever this app is not exempt, which is the normal case.
      return 'step_up_required';
    }
  },
  verifyOtp: async (code: string) => {
    set({ isVerifying: true, lastError: null });
    try {
      const result = await verifyStepUp(code.trim());
      const expiresAt = result?.StepUpExpiresOnUtc ? Date.parse(result.StepUpExpiresOnUtc) : NaN;
      // A token-less response is a failure, not a grant. Accepting one would flip the UI to
      // "revealed" while getGrantHeaders() still sends nothing, so every value stays REDACTED
      // with no error to explain it — the same invariant ensureGrant() already enforces.
      if (!result?.GrantToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        set({ isVerifying: false, lastError: 'unknown' });
        return false;
      }
      set({
        grantToken: result.GrantToken,
        stepUpExpiresAt: expiresAt,
        isVerifying: false,
        lastError: null,
      });
      return true;
    } catch (error) {
      // Never log the code; the error object carries only the HTTP problem envelope.
      logger.warn({
        message: 'ADP step-up verification failed',
        context: { errorType: parseErrorCode(error) },
      });
      set({ isVerifying: false, lastError: parseErrorCode(error) });
      return false;
    }
  },
  isStepUpActive: () => {
    const { grantToken, stepUpExpiresAt } = get();
    // Both halves are required. A future expiry with no token buys nothing: getGrantHeaders()
    // would send no header, so the record comes back redacted while the UI claims otherwise.
    return !!grantToken && stepUpExpiresAt != null && Date.now() < stepUpExpiresAt;
  },
  getGrantHeaders: () => {
    const state = get();
    // Expiry is checked here rather than trusted from state: a grant that lapsed while a screen
    // sat open must not be attached to the next request.
    const headers: Record<string, string> = {};
    if (!state.grantToken || !state.isStepUpActive()) {
      return headers;
    }

    headers[GRANT_HEADER] = state.grantToken;
    return headers;
  },
  clearStepUp: () => set({ stepUpExpiresAt: null, grantToken: null, lastError: null }),
}));

// The grant is memory-only and must never survive the session: drop everything the moment the
// auth status leaves 'signedIn' (logout, token revocation, forced deauth).
//
// Guarded because this module is now in the import graph of any screen showing a protected value,
// and a store that throws at import time takes the whole screen down with it. Losing the
// subscription costs the in-session logout sweep only — the grant is memory-only either way, so it
// never survives a reload — but it is logged rather than swallowed, so it cannot go unnoticed.
if (typeof useAuthStore?.subscribe === 'function') {
  useAuthStore.subscribe((state: { status: string }, prevState: { status: string }) => {
    if (prevState.status === 'signedIn' && state.status !== 'signedIn') {
      dataProtectionStore.setState({
        capabilities: null,
        isCapabilitiesLoaded: false,
        stepUpExpiresAt: null,
        grantToken: null,
        isVerifying: false,
        isRequestingGrant: false,
        isPromptOpen: false,
        lastError: null,
      });
    }
  });
} else {
  logger.warn({ message: 'ADP grant store could not subscribe to auth changes; sign-out will not sweep the grant early.' });
}

// Every read through the shared API client carries the grant while one is held — see
// setProtectedGrantProvider. Registered here rather than imported there, because the client is
// what this store's own API layer is built on.
setProtectedGrantProvider(() => dataProtectionStore.getState().getGrantHeaders());

/** Reactive: true while protection is enabled for the department (unknown reads as false). */
export const useIsProtectionEnabled = () => dataProtectionStore((state) => !!state.capabilities?.isProtectionEnabled);

/**
 * Reactive step-up flag. Re-renders on verify/clear; expiry itself is time-based, so callers
 * gating a reveal must ALSO call isStepUpActive() at the moment of use.
 */
export const useStepUpExpiresAt = () => dataProtectionStore((state) => state.stepUpExpiresAt);

/**
 * Reactive: whether a grant token is held at all. Paired with useStepUpExpiresAt by callers that
 * render a reveal state, because an expiry alone does not make a grant usable.
 */
export const useHasGrantToken = () => dataProtectionStore((state) => !!state.grantToken);

/** Headers helper for one-off calls outside a component. */
export const getProtectedGrantHeaders = () => dataProtectionStore.getState().getGrantHeaders();

/** Reactive: whether the single app-level OTP prompt should be showing. */
export const useIsStepUpPromptOpen = () => dataProtectionStore((state) => state.isPromptOpen);
