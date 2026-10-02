import axios from 'axios';

import { getBaseApiUrl } from '@/lib/storage/app';

import { applyClientHeaders } from './client-app';
import type { ApprovalRequestData, ApprovalStatusData, CompletionData, FactorRecoveryStatusData, PasskeyCeremonyData, RecoveryCompleteData, SsoBeginData, SsoRedeemData, TotpSetupData, V4Result } from './types';

// ---------------------------------------------------------------------------
// The sign-in transaction calls (passkey plan sections 7.5 and 7.7.2): no bearer token; the transaction secret is the
// only authority, and the app header must match the app that started it. Bodies are PascalCase JSON: the server binds
// names case-insensitively but never snake_case.
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15000;

const transactionApi = axios.create({ timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } });

transactionApi.interceptors.request.use((config) => {
  config.baseURL = getBaseApiUrl();
  applyClientHeaders(config.headers);
  return config;
});

const post = async <T>(path: string, body: Record<string, unknown>): Promise<T> => (await transactionApi.post<V4Result<T>>(path, body)).data.Data;

// ---- Second factor for a sign-in ---------------------------------------------------------------------------------------

export const completeTotp = (transaction: string, code: string) => post<CompletionData>('/Authentication/CompleteTotp', { Transaction: transaction, Code: code });

export const completeRecoveryCode = (transaction: string, code: string) => post<CompletionData>('/Authentication/CompleteRecoveryCode', { Transaction: transaction, Code: code });

export const loginPasskeyOptions = (transaction: string) => post<PasskeyCeremonyData>('/Authentication/PasskeyOptions', { Transaction: transaction });

export const completePasskey = (transaction: string, requestId: string, credential: Record<string, unknown>) =>
  post<CompletionData>('/Authentication/CompletePasskey', { Transaction: transaction, RequestId: requestId, Credential: credential });

export const completeApproval = (transaction: string, approvalRequestId: string) => post<CompletionData>('/Authentication/CompleteApproval', { Transaction: transaction, ApprovalRequestId: approvalRequestId });

export const completeFederated = (transaction: string, ssoTransactionId: string, ssoCode: string, codeVerifier: string) =>
  post<CompletionData>('/Authentication/CompleteFederated', { Transaction: transaction, SsoTransactionId: ssoTransactionId, SsoCode: ssoCode, CodeVerifier: codeVerifier });

// ---- Setting up an authenticator the department requires (plan section 6.2) ---------------------------------------------

export const totpSetupOptions = (transaction: string) => post<TotpSetupData>('/Authentication/TotpSetupOptions', { Transaction: transaction });

export const completeTotpSetup = (transaction: string, code: string) => post<CompletionData>('/Authentication/CompleteTotpSetup', { Transaction: transaction, Code: code });

// ---- Approve with Responder, for a sign-in (plan section 7.9) -------------------------------------------------------------

export const requestLoginApproval = (transaction: string) => post<ApprovalRequestData>('/MfaApproval/Request', { Purpose: 'login', Transaction: transaction });

export const loginApprovalStatus = (transaction: string, approvalRequestId: string) => post<ApprovalStatusData>('/MfaApproval/Status', { Transaction: transaction, ApprovalRequestId: approvalRequestId });

export const cancelLoginApproval = (transaction: string, approvalRequestId: string) => post<ApprovalStatusData>('/MfaApproval/Cancel', { Transaction: transaction, ApprovalRequestId: approvalRequestId });

// ---- Brokered SSO (plan section 7.7.2) -----------------------------------------------------------------------------------

export interface SsoBeginInput {
  Purpose: 'login' | 'step_up';
  ReturnTarget: string;
  State: string;
  CodeChallenge: string;
  Platform: string;
  DepartmentToken?: string;
  DepartmentCode?: string;
  Username?: string;
  /** For a provider step-up that finishes a password sign-in. */
  Transaction?: string;
}

export const ssoBegin = (input: SsoBeginInput) => post<SsoBeginData>('/Sso/Begin', { ...input, CodeChallengeMethod: 'S256' });

export const ssoRedeem = (ssoTransactionId: string, ssoCode: string, codeVerifier: string) => post<SsoRedeemData>('/Sso/Redeem', { SsoTransactionId: ssoTransactionId, SsoCode: ssoCode, CodeVerifier: codeVerifier });

// ---- "I lost my authenticator" (plan sections 5.4 and 6.3) --------------------------------------------------------------

export const beginFactorRecovery = (transaction: string, recoveryCode: string) => post<FactorRecoveryStatusData>('/AccountSecurity/BeginFactorRecovery', { Transaction: transaction, Code: recoveryCode });

export const prepareRecoveryReplacement = (recovery: string) => post<TotpSetupData>('/AccountSecurity/PrepareReplacement', { Transaction: recovery });

export const completeFactorRecovery = (recovery: string, code: string, removePasskeyIds: string[]) =>
  post<RecoveryCompleteData>('/AccountSecurity/CompleteFactorRecovery', { Transaction: recovery, Code: code, RemovePasskeyIds: removePasskeyIds });

export const cancelFactorRecovery = (recovery: string) => post<FactorRecoveryStatusData>('/AccountSecurity/CancelFactorRecovery', { Transaction: recovery });
