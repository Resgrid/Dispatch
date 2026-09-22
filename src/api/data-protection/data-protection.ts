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
