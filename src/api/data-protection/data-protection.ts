import { api } from '../common/client';

const DATA_PROTECTION = '/DataProtection';

// ---------------------------------------------------------------------------
// Advanced Data Protection (ADP) — capability report, MFA step-up, and the
// exemption path.
//
// The step-up window is ABSOLUTE: the server returns its expiry once and never
// slides it. Clients conceal protected values at expiry and ask again on the
// next reveal.
// ---------------------------------------------------------------------------

export interface DataProtectionCapabilitiesData {
  State: number;
  StateName?: string | null;
  IsProtectionEnabled: boolean;
  CatalogVersion: number;
  CurrentCatalogVersion: number;
  PolicyEpoch: number;
  StepUpWindowMinutes: number;
  IsDepartmentLocked: boolean;
  LockReason?: string | null;
  LockProjectedEndUtc?: string | null;
}

export interface DataProtectionCapabilitiesResult {
  Data?: DataProtectionCapabilitiesData;
}

export interface StepUpResult {
  /** Grant id (jti) for display/audit correlation; null when grants are not configured. */
  GrantId?: string | null;
  /** Signed Protected Data Grant. MEMORY ONLY — never persisted, never logged. */
  GrantToken?: string | null;
  /** Absolute UTC expiry of the step-up window (ISO 8601). */
  StepUpExpiresOnUtc?: string | null;
  StepUpWindowMinutes?: number;
}

/** Value-free ADP capability report for the caller's department. */
export const getDataProtectionCapabilities = async (signal?: AbortSignal) => {
  const response = await api.get<DataProtectionCapabilitiesResult>(`${DATA_PROTECTION}/Capabilities`, { signal });
  return response.data;
};

/**
 * Asks for a grant WITHOUT a second factor.
 *
 * A department may release named apps from the step-up prompt (ADP plan 3.3) — a dispatcher on a
 * live incident cannot stop to read a code off a phone. The server answers with a grant when this
 * department has exempted THIS app, and with `step_up_required` otherwise. The client never makes
 * that decision; it only asks and reacts.
 *
 * Nothing is weakened by asking: the caller is still authenticated, and the grant that comes back
 * is still tenant-bound, epoch-bound, short-lived and audited on every read it authorizes.
 */
export const requestProtectedGrant = async () => {
  const response = await api.post<StepUpResult>(`${DATA_PROTECTION}/RequestGrant`, {});
  return response.data;
};

/**
 * Verifies the user's authenticator (TOTP) code for the ADP step-up.
 * Server problem types: invalid_totp (400/401), mfa_not_enrolled (409),
 * too_many_attempts (429). The code is never logged anywhere.
 */
export const verifyStepUp = async (code: string) => {
  const response = await api.post<StepUpResult>(`${DATA_PROTECTION}/VerifyStepUp`, { Code: code });
  return response.data;
};

// ---------------------------------------------------------------------------
// Step-up by other methods (passkey plan sections 7.8, 7.9 and 8.1): a passkey for this app, approval from the member's
// Responder, or the department's identity provider. Every method ends in the same StepUpResult grant; the server
// decides which ones this department and member may use.
// ---------------------------------------------------------------------------

export interface StepUpMethodsData {
  /** What this member has and the department accepts for protected data, in the server's order. */
  Methods: string[];
  Preferred: string | null;
  EnrolledMethods: string[];
  AllowedMethods: string[];
}

interface PasskeyCeremony {
  RequestId: string;
  Options: Record<string, unknown>;
}

export const getStepUpMethods = async () => {
  const response = await api.get<{ Data: StepUpMethodsData }>(`${DATA_PROTECTION}/StepUpMethods`);
  return response.data.Data;
};

export const getStepUpPasskeyOptions = async () => {
  const response = await api.post<{ Data: PasskeyCeremony }>(`${DATA_PROTECTION}/PasskeyOptions`, {});
  return response.data.Data;
};

export const verifyStepUpPasskey = async (requestId: string, credential: Record<string, unknown>) => {
  const response = await api.post<StepUpResult>(`${DATA_PROTECTION}/VerifyPasskey`, { RequestId: requestId, Credential: credential });
  return response.data;
};

/** Asks the member's Responder to approve access to protected data; the number is shown on this screen only. */
export const requestStepUpApproval = async () => {
  const response = await api.post<{ Data: { ApprovalRequestId: string; MatchNumber: string; ExpiresIn: number } }>('/MfaApproval/Request', { Purpose: 'adp' });
  return response.data.Data;
};

export const getStepUpApprovalStatus = async (approvalRequestId: string) => {
  const response = await api.post<{ Data: { State: 'pending' | 'approved' | 'denied' | 'expired' | 'canceled' | 'consumed'; ExpiresAt: string | null } }>('/MfaApproval/Status', { ApprovalRequestId: approvalRequestId });
  return response.data.Data;
};

export const cancelStepUpApproval = async (approvalRequestId: string) => {
  await api.post('/MfaApproval/Cancel', { ApprovalRequestId: approvalRequestId });
};

export const completeStepUpApproval = async (approvalRequestId: string) => {
  const response = await api.post<StepUpResult>(`${DATA_PROTECTION}/CompleteApproval`, { ApprovalRequestId: approvalRequestId });
  return response.data;
};

export interface StepUpSsoSecrets {
  returnTarget: string;
  state: string;
  codeChallenge: string;
  platform: string;
}

/** Begins a provider step-up for protected data, bound to this session (the broker reads the app from the session). */
export const beginStepUpSso = async (secrets: StepUpSsoSecrets) => {
  const response = await api.post<{ Data: { AuthorizeUrl: string; SsoTransactionId: string; ExpiresIn: number } }>('/Sso/Begin', {
    Purpose: 'adp_step_up',
    ReturnTarget: secrets.returnTarget,
    State: secrets.state,
    CodeChallenge: secrets.codeChallenge,
    CodeChallengeMethod: 'S256',
    Platform: secrets.platform,
  });
  return response.data.Data;
};

export const completeStepUpFederated = async (ssoTransactionId: string, ssoCode: string, codeVerifier: string) => {
  const response = await api.post<StepUpResult>(`${DATA_PROTECTION}/CompleteFederated`, { SsoTransactionId: ssoTransactionId, SsoCode: ssoCode, CodeVerifier: codeVerifier });
  return response.data;
};
