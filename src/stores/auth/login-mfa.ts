import { completionGrantRequest } from '@/lib/auth/api';
import type { AuthResponse } from '@/lib/auth/types';
import { logger } from '@/lib/logging';
import { type ApprovalWaitResult, waitForApproval } from '@/lib/mfa/approval-wait';
import { endsTransaction, type MfaProblem, toMfaProblem } from '@/lib/mfa/errors';
import { getPasskeyAssertion } from '@/lib/mfa/passkey';
import { isPasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';
import {
  beginFactorRecovery,
  cancelFactorRecovery,
  cancelLoginApproval,
  completeApproval,
  completeFactorRecovery,
  completeFederated,
  completePasskey,
  completeRecoveryCode,
  completeTotp,
  completeTotpSetup,
  loginApprovalStatus,
  loginPasskeyOptions,
  prepareRecoveryReplacement,
  requestLoginApproval,
  ssoBegin,
  ssoRedeem,
  totpSetupOptions,
} from '@/lib/mfa/transaction-api';
import { type ApprovalRequestData, type CompletionData, type MfaChallenge, parseMethods, type PasskeyData, type TotpSetupData } from '@/lib/mfa/types';

// ---------------------------------------------------------------------------
// Signing in on a login transaction (passkey plan sections 7.5, 7.7.2 and 6.2-6.3). The transaction and recovery
// secrets are the only authority for finishing a sign-in, so they live in this module's memory only: never in the
// persisted auth store, never in logs, and never past the sign-in they belong to.
// ---------------------------------------------------------------------------

let loginTransaction: string | null = null;
let factorRecovery: string | null = null;

/** A second factor for the current sign-in. */
export type LoginMfaStep =
  | { method: 'totp'; code: string }
  | { method: 'recovery_code'; code: string }
  | { method: 'passkey' }
  | { method: 'passkey_approval'; approvalRequestId: string }
  | { method: 'federated' }
  | { method: 'setup'; code: string };

export type LoginMfaResult = { ok: true; recovery: boolean } | { ok: false; code: string; restart: boolean };

/** What the auth store provides: finishing a sign-in with tokens, and moving the visible sign-in state. */
export interface LoginMfaHost {
  signIn: (authResponse: AuthResponse, recoveryCodes: string[] | null) => void;
  setChallenge: (challenge: MfaChallenge | null, error?: string | null) => void;
  restart: (code: string) => void;
}

export const holdLoginTransaction = (secret: string | null): void => {
  loginTransaction = secret;
};

export const hasLoginTransaction = (): boolean => loginTransaction !== null;

/** Drops every sign-in secret: cancel, sign-out, or a sign-in that ended. */
export const forgetLoginSecrets = (): void => {
  loginTransaction = null;
  factorRecovery = null;
};

const failed = (host: LoginMfaHost, problem: MfaProblem): LoginMfaResult => {
  if (endsTransaction(problem)) {
    forgetLoginSecrets();
    host.restart(problem.code);
    return { ok: false, code: problem.code, restart: true };
  }
  return { ok: false, code: problem.code, restart: false };
};

const finish = async (host: LoginMfaHost, secret: string, completion: CompletionData): Promise<LoginMfaResult> => {
  const tokens = await completionGrantRequest(secret, completion.CompletionCode);
  loginTransaction = null;
  host.signIn(tokens, completion.RecoveryCodes ?? null);
  logger.info({ message: 'Signed in with a second factor', context: { recovery: completion.Recovery } });
  return { ok: true, recovery: !!completion.Recovery };
};

/** Finishes the current sign-in with one second factor. A refusal that ends the sign-in sends the member back to the start. */
export const verifyLoginMfa = async (host: LoginMfaHost, step: LoginMfaStep): Promise<LoginMfaResult> => {
  const secret = loginTransaction;
  if (!secret) {
    host.restart('mfa_transaction_invalid');
    return { ok: false, code: 'mfa_transaction_invalid', restart: true };
  }

  try {
    let completion: CompletionData;
    switch (step.method) {
      case 'totp':
        completion = await completeTotp(secret, step.code.trim());
        break;
      case 'recovery_code':
        completion = await completeRecoveryCode(secret, step.code.trim());
        break;
      case 'setup':
        completion = await completeTotpSetup(secret, step.code.trim());
        break;
      case 'passkey': {
        const ceremony = await loginPasskeyOptions(secret);
        const credential = await getPasskeyAssertion(ceremony.Options);
        completion = await completePasskey(secret, ceremony.RequestId, credential);
        break;
      }
      case 'passkey_approval':
        completion = await completeApproval(secret, step.approvalRequestId);
        break;
      case 'federated': {
        const trip = await runSsoRoundTrip((secrets) =>
          ssoBegin({ Purpose: 'step_up', Transaction: secret, ReturnTarget: secrets.returnTarget, State: secrets.state, CodeChallenge: secrets.codeChallenge, Platform: secrets.platform })
        );
        if (!trip.ok) {
          return trip.code ? failed(host, { code: trip.code, status: null }) : { ok: false, code: `sso_${trip.reason}`, restart: false };
        }
        completion = await completeFederated(secret, trip.trip.ssoTransactionId, trip.trip.ssoCode, trip.trip.codeVerifier);
        break;
      }
    }
    return await finish(host, secret, completion);
  } catch (error) {
    if (isPasskeyCeremonyError(error)) {
      return { ok: false, code: `passkey_${error.reason}`, restart: false };
    }
    return failed(host, toMfaProblem(error));
  }
};

// ---- Approve with Responder, from another app's sign-in ---------------------------------------------------------------

export const startLoginApproval = async (host: LoginMfaHost): Promise<ApprovalRequestData | { code: string; restart: boolean }> => {
  if (!loginTransaction) {
    host.restart('mfa_transaction_invalid');
    return { code: 'mfa_transaction_invalid', restart: true };
  }
  try {
    return await requestLoginApproval(loginTransaction);
  } catch (error) {
    const result = failed(host, toMfaProblem(error));
    return { code: result.ok ? 'unknown_error' : result.code, restart: !result.ok && result.restart };
  }
};

/**
 * Waits for the member's Responder to decide. A status refusal that ends the sign-in itself (it expired, or the policy
 * changed) sends the member back to the start, as any other step does, instead of reading as the service being down.
 */
export const waitForLoginApproval = async (host: LoginMfaHost, approvalRequestId: string, signal?: AbortSignal): Promise<ApprovalWaitResult> => {
  const secret = loginTransaction;
  if (!secret) {
    return 'unavailable';
  }
  const refused: { problem: MfaProblem | null } = { problem: null };
  const decided = await waitForApproval(async () => {
    try {
      return await loginApprovalStatus(secret, approvalRequestId);
    } catch (error) {
      refused.problem = toMfaProblem(error);
      throw error;
    }
  }, signal);
  if (refused.problem) {
    // As for any other step: only a refusal that ends the sign-in sends the member back to the start.
    failed(host, refused.problem);
  }
  return decided;
};

export const cancelLoginApprovalRequest = async (approvalRequestId: string): Promise<void> => {
  if (loginTransaction) {
    await cancelLoginApproval(loginTransaction, approvalRequestId).catch(() => undefined);
  }
};

// ---- Setting up the authenticator the department requires (plan section 6.2) ------------------------------------------

export const loginSetupOptions = async (host: LoginMfaHost): Promise<TotpSetupData | { code: string; restart: boolean }> => {
  if (!loginTransaction) {
    host.restart('mfa_transaction_invalid');
    return { code: 'mfa_transaction_invalid', restart: true };
  }
  try {
    return await totpSetupOptions(loginTransaction);
  } catch (error) {
    const result = failed(host, toMfaProblem(error));
    return { code: result.ok ? 'unknown_error' : result.code, restart: !result.ok && result.restart };
  }
};

// ---- Brokered single sign-on (plan section 7.7.2) ---------------------------------------------------------------------

export interface SsoDepartment {
  departmentToken?: string;
  departmentCode?: string;
  username?: string;
}

export type BrokeredSsoResult = { outcome: 'signed_in' } | { outcome: 'challenge'; challenge: MfaChallenge } | { outcome: 'cancelled' } | { outcome: 'failed'; code: string };

/** Signs in through the department's identity provider: the browser round trip, then the redemption, then a second factor if one is needed. */
export const signInWithBrokeredSso = async (host: LoginMfaHost, department: SsoDepartment, ephemeral?: boolean): Promise<BrokeredSsoResult> => {
  forgetLoginSecrets();
  const trip = await runSsoRoundTrip(
    (secrets) =>
      ssoBegin({
        Purpose: 'login',
        ...(department.departmentToken ? { DepartmentToken: department.departmentToken } : {}),
        ...(department.departmentCode ? { DepartmentCode: department.departmentCode } : {}),
        ...(department.username ? { Username: department.username } : {}),
        ReturnTarget: secrets.returnTarget,
        State: secrets.state,
        CodeChallenge: secrets.codeChallenge,
        Platform: secrets.platform,
      }),
    ephemeral
  );
  if (!trip.ok) {
    return trip.reason === 'cancelled' ? { outcome: 'cancelled' } : { outcome: 'failed', code: trip.code ?? `sso_${trip.reason}` };
  }

  try {
    const redeemed = await ssoRedeem(trip.trip.ssoTransactionId, trip.trip.ssoCode, trip.trip.codeVerifier);
    if (redeemed.Outcome === 'completed' && redeemed.Transaction && redeemed.CompletionCode) {
      const tokens = await completionGrantRequest(redeemed.Transaction, redeemed.CompletionCode);
      host.signIn(tokens, null);
      return { outcome: 'signed_in' };
    }
    if (redeemed.Outcome === 'mfa_required' && redeemed.Transaction) {
      loginTransaction = redeemed.Transaction;
      const challenge: MfaChallenge = {
        kind: 'verify',
        methods: parseMethods(redeemed.MfaMethods),
        enrolled: parseMethods(redeemed.MfaEnrolled),
        preferred: parseMethods(redeemed.MfaPreferred)[0] ?? null,
        expiresAt: redeemed.ExpiresIn > 0 ? Date.now() + redeemed.ExpiresIn * 1000 : null,
        source: 'sso',
      };
      host.setChallenge(challenge);
      return { outcome: 'challenge', challenge };
    }
    return { outcome: 'failed', code: 'sso_failed' };
  } catch (error) {
    // A department that requires MFA the account does not have yet continues as the setup transaction.
    const body = (error as { response?: { data?: { type?: string; mfa_setup_transaction?: string; mfa_expires_in?: number } } })?.response?.data;
    if (body?.type === 'mfa_enrollment_required' && body.mfa_setup_transaction) {
      loginTransaction = body.mfa_setup_transaction;
      const challenge: MfaChallenge = {
        kind: 'setup',
        methods: ['totp'],
        enrolled: [],
        preferred: 'totp',
        expiresAt: typeof body.mfa_expires_in === 'number' ? Date.now() + body.mfa_expires_in * 1000 : null,
        source: 'sso',
      };
      host.setChallenge(challenge);
      return { outcome: 'challenge', challenge };
    }
    return { outcome: 'failed', code: toMfaProblem(error).code };
  }
};

// ---- "I lost my authenticator" (plan sections 5.4 and 6.3) ------------------------------------------------------------

export interface RecoveryStart {
  passkeys: PasskeyData[];
  expiresAt: number | null;
}

/** Spends a recovery code to open the restricted recovery. The sign-in itself ends; no session is created. */
export const startFactorRecovery = async (host: LoginMfaHost, recoveryCode: string): Promise<RecoveryStart | { code: string; restart: boolean }> => {
  const secret = loginTransaction;
  if (!secret) {
    host.restart('mfa_transaction_invalid');
    return { code: 'mfa_transaction_invalid', restart: true };
  }
  try {
    const started = await beginFactorRecovery(secret, recoveryCode.trim());
    loginTransaction = null;
    factorRecovery = started.Transaction;
    // The sign-in is spent; recovery takes over, and nothing signs in until the member does so again.
    host.setChallenge(null);
    return { passkeys: started.Passkeys ?? [], expiresAt: started.ExpiresIn > 0 ? Date.now() + started.ExpiresIn * 1000 : null };
  } catch (error) {
    const result = failed(host, toMfaProblem(error));
    return { code: result.ok ? 'unknown_error' : result.code, restart: !result.ok && result.restart };
  }
};

export const recoveryReplacementKey = async (): Promise<TotpSetupData | { code: string }> => {
  if (!factorRecovery) {
    return { code: 'recovery_transaction_invalid' };
  }
  try {
    return await prepareRecoveryReplacement(factorRecovery);
  } catch (error) {
    return { code: toMfaProblem(error).code };
  }
};

/** Replaces the authenticator; every session ends and the member signs in again. Returns the new recovery codes, shown once. */
export const finishFactorRecovery = async (code: string, removePasskeyIds: string[]): Promise<{ recoveryCodes: string[] } | { code: string; ended: boolean }> => {
  if (!factorRecovery) {
    return { code: 'recovery_transaction_invalid', ended: true };
  }
  try {
    const done = await completeFactorRecovery(factorRecovery, code.trim(), removePasskeyIds);
    factorRecovery = null;
    return { recoveryCodes: done.RecoveryCodes ?? [] };
  } catch (error) {
    const problem = toMfaProblem(error);
    const ended = endsTransaction(problem);
    if (ended) {
      factorRecovery = null;
    }
    return { code: problem.code, ended };
  }
};

export const abandonFactorRecovery = async (): Promise<void> => {
  const secret = factorRecovery;
  factorRecovery = null;
  if (secret) {
    await cancelFactorRecovery(secret).catch(() => undefined);
  }
};
