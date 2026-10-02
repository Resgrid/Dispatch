/**
 * What the server said when it refused an MFA, passkey, approval, SSO or session call (passkey workbook section 7.6). The
 * v4 API answers with ProblemDetails (`type`); the token endpoint and the locked-session middleware answer with `error`.
 * Clients switch on the code, never on the human text.
 */
export interface MfaProblem {
  code: string;
  status: number | null;
  /** The shared session's lock version, when the refusal was "locked". */
  lockVersion?: number;
}

/** A sign-in transaction that can no longer finish: the member signs in again from the start. */
export const TRANSACTION_ENDING_CODES = new Set([
  'mfa_transaction_invalid',
  'mfa_transaction_expired',
  'too_many_attempts',
  'policy_changed',
  'session_revoked',
  'recovery_transaction_invalid',
  'recovery_transaction_expired',
]);

interface ErrorBody {
  type?: unknown;
  error?: unknown;
  lock_version?: unknown;
}

export const toMfaProblem = (error: unknown): MfaProblem => {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (!response) {
    return { code: 'network_error', status: null };
  }

  const body = (typeof response.data === 'object' && response.data !== null ? response.data : {}) as ErrorBody;
  const code = typeof body.type === 'string' && body.type ? body.type : typeof body.error === 'string' && body.error ? body.error : 'unknown_error';
  const problem: MfaProblem = { code, status: typeof response.status === 'number' ? response.status : null };
  if (typeof body.lock_version === 'number') {
    problem.lockVersion = body.lock_version;
  }
  return problem;
};

/** Whether the refusal ends the sign-in (rather than asking for another try or another method). */
export const endsTransaction = (problem: MfaProblem): boolean => TRANSACTION_ENDING_CODES.has(problem.code);
