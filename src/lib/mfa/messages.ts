/**
 * The translation key for a refusal code (passkey workbook section 7.6, plus this app's own passkey and SSO outcomes).
 * Codes the app has no message for fall back to a generic one; the code itself is never shown.
 */
const KNOWN = new Set([
  'access_denied',
  'approval_denied',
  'approval_expired',
  'approval_pending',
  'approval_suspended',
  'approval_unavailable',
  'challenge_consumed',
  'challenge_expired',
  'federated_identity_mismatch',
  'federated_mfa_not_satisfied',
  'invalid_recovery_code',
  'invalid_totp',
  'mfa_enrollment_required',
  'mfa_method_not_allowed',
  'mfa_not_enrolled',
  'mfa_transaction_expired',
  'mfa_transaction_invalid',
  'network_error',
  'passkey_cancelled',
  'passkey_failed',
  'passkey_no_credentials',
  'passkey_not_registered_for_client',
  'passkey_not_supported',
  'passkey_verification_failed',
  'passkeys_unavailable',
  'policy_changed',
  'reauthentication_required',
  'recovery_transaction_expired',
  'recovery_transaction_invalid',
  'service_unavailable',
  'session_revoked',
  'setup_expired',
  'shared_session_lock_changed',
  'sso_cancelled',
  'sso_denied',
  'sso_failed',
  'sso_reauthentication_required',
  'sso_state_mismatch',
  'sso_unavailable',
  'step_up_required',
  'too_many_attempts',
]);

export const mfaErrorKey = (code: string | null | undefined): string => `mfa.errors.${code && KNOWN.has(code) ? code : 'unknown_error'}`;

/** Whether an auth-store error is one of these codes (shown translated) rather than free text from elsewhere. */
export const isMfaErrorCode = (value: string | null | undefined): value is string => !!value && KNOWN.has(value);
