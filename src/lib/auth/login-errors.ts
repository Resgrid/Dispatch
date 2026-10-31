import type { TFunction } from 'i18next';

/**
 * Why a password sign-in failed, as the login screen explains it: the reasons the server reports in `login_error`
 * beside `invalid_grant`, plus what the app can tell on its own (the server could not be reached, is not a Resgrid
 * server, is throttling, or failed).
 */
export type LoginErrorCode =
  | 'invalid_credentials'
  | 'account_locked_out'
  | 'account_disabled'
  | 'account_not_activated'
  | 'no_department'
  | 'sso_required'
  | 'maximum_sessions'
  | 'department_access_denied'
  | 'server_unreachable'
  | 'server_not_resgrid'
  | 'rate_limited'
  | 'server_error'
  | 'login_failed';

export interface LoginFailure {
  code: LoginErrorCode;
  /** Minutes left on a temporary lockout, when the server says; absent for a lockout only an administrator can lift. */
  lockoutMinutes?: number;
}

// The reasons a server that knows login_error can send.
const SERVER_REASONS = new Set<string>(['invalid_credentials', 'account_locked_out', 'account_disabled', 'account_not_activated', 'no_department', 'sso_required', 'maximum_sessions', 'department_access_denied']);

const LOGIN_ERROR_CODES = new Set<string>([...SERVER_REASONS, 'server_unreachable', 'server_not_resgrid', 'rate_limited', 'server_error', 'login_failed']);

/** Whether an auth-store error is one of these codes (shown with its guidance) rather than a code or text from elsewhere. */
export const isLoginErrorCode = (value: string | null | undefined): value is LoginErrorCode => !!value && LOGIN_ERROR_CODES.has(value);

interface TokenErrorBody {
  error?: unknown;
  error_description?: unknown;
  login_error?: unknown;
  lockout_minutes_remaining?: unknown;
}

/**
 * Classifies a failed token request. A server older than login_error answers every refused password sign-in with the
 * same invalid_grant; only its session-limit refusals have their own descriptions.
 */
export const classifyLoginFailure = (error: unknown): LoginFailure => {
  const candidate = error as { isAxiosError?: boolean; response?: { status?: number; data?: unknown } } | null;
  if (!candidate?.isAxiosError) {
    return { code: 'login_failed' };
  }

  // No response at all: offline, DNS, TLS, CORS, a timeout, or a server address that is not listening.
  const response = candidate.response;
  if (!response) {
    return { code: 'server_unreachable' };
  }

  const status = response.status ?? 0;
  const body: TokenErrorBody | null = typeof response.data === 'object' && response.data !== null ? (response.data as TokenErrorBody) : null;

  if (body && typeof body.login_error === 'string' && SERVER_REASONS.has(body.login_error)) {
    const minutes = body.lockout_minutes_remaining;
    return {
      code: body.login_error as LoginErrorCode,
      ...(typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? { lockoutMinutes: Math.ceil(minutes) } : {}),
    };
  }

  if (status === 429) {
    return { code: 'rate_limited' };
  }

  if (body?.error === 'invalid_grant') {
    const description = typeof body.error_description === 'string' ? body.error_description : '';
    if (description.includes('maximum number of active sessions')) {
      return { code: 'maximum_sessions' };
    }
    if (description.includes('no longer allowed to sign in to this department')) {
      return { code: 'department_access_denied' };
    }
    return { code: 'invalid_credentials' };
  }

  if (body?.error === 'temporarily_unavailable' || status >= 500) {
    return { code: 'server_error' };
  }

  // A web page or a 404 where the token endpoint should be: the address points at something other than a Resgrid API.
  if (!body || status === 404 || status === 405) {
    return { code: 'server_not_resgrid' };
  }

  return { code: 'login_failed' };
};

/**
 * The title and guidance for a failed sign-in. `server` is the name of the server the member is signing in to (as the
 * login form shows it), so a connection problem says which server could not be reached.
 */
export const describeLoginFailure = (t: TFunction, failure: LoginFailure, server: string): { title: string; message: string } => {
  // A lockout with no end is an administrator's to lift; waiting will not help.
  const key = failure.code === 'account_locked_out' && failure.lockoutMinutes == null ? 'account_locked' : failure.code;
  return {
    title: t(`login.errors.${key}.title`),
    message: t(`login.errors.${key}.message`, { minutes: failure.lockoutMinutes, server }),
  };
};
