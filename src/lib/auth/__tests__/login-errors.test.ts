import type { TFunction } from 'i18next';

import ar from '@/translations/ar.json';
import de from '@/translations/de.json';
import el from '@/translations/el.json';
import en from '@/translations/en.json';
import es from '@/translations/es.json';
import fr from '@/translations/fr.json';
import itLang from '@/translations/it.json';
import pl from '@/translations/pl.json';
import sv from '@/translations/sv.json';
import uk from '@/translations/uk.json';

import { classifyLoginFailure, describeLoginFailure, isLoginErrorCode, isServerLoginReason, type LoginErrorCode } from '../login-errors';

const axiosError = (status?: number, data?: unknown) => ({
  isAxiosError: true,
  message: status ? `Request failed with status code ${status}` : 'Network Error',
  response: status ? { status, data } : undefined,
});

const ALL_CODES: LoginErrorCode[] = [
  'invalid_credentials',
  'account_locked_out',
  'account_disabled',
  'account_not_activated',
  'no_department',
  'sso_required',
  'maximum_sessions',
  'department_access_denied',
  'server_unreachable',
  'server_not_resgrid',
  'rate_limited',
  'server_error',
  'login_failed',
];

describe('classifyLoginFailure', () => {
  it('reads the reason the server sends in login_error', () => {
    for (const reason of ['invalid_credentials', 'account_disabled', 'account_not_activated', 'no_department', 'sso_required', 'maximum_sessions', 'department_access_denied']) {
      expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', login_error: reason }))).toEqual({ code: reason });
    }
  });

  it('keeps the minutes left on a temporary lockout', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', login_error: 'account_locked_out', lockout_minutes_remaining: 12 }))).toEqual({ code: 'account_locked_out', lockoutMinutes: 12 });
  });

  it('leaves the minutes out of a lockout with no end', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', login_error: 'account_locked_out' }))).toEqual({ code: 'account_locked_out' });
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', login_error: 'account_locked_out', lockout_minutes_remaining: 'soon' }))).toEqual({ code: 'account_locked_out' });
  });

  it('ignores a login_error it does not know', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', login_error: 'something_new' }))).toEqual({ code: 'invalid_credentials' });
  });

  it('reads login_error only beside invalid_grant', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_client', login_error: 'account_disabled' }))).toEqual({ code: 'login_failed' });
    expect(classifyLoginFailure(axiosError(500, { login_error: 'account_disabled' }))).toEqual({ code: 'server_error' });
  });

  it('tells a throttled member to wait whatever reason the body gives', () => {
    expect(classifyLoginFailure(axiosError(429, { error: 'invalid_grant', login_error: 'account_locked_out', lockout_minutes_remaining: 5 }))).toEqual({ code: 'rate_limited' });
  });

  it('treats a bare invalid_grant from an older server as wrong credentials', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', error_description: 'The username or password is invalid.' }))).toEqual({ code: 'invalid_credentials' });
  });

  it("recognizes an older server's session refusals by their descriptions", () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', error_description: "The department's maximum number of active sessions has been reached." }))).toEqual({ code: 'maximum_sessions' });
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_grant', error_description: 'The user is no longer allowed to sign in to this department.' }))).toEqual({ code: 'department_access_denied' });
  });

  it('reports a request that never got a response as an unreachable server', () => {
    expect(classifyLoginFailure(axiosError())).toEqual({ code: 'server_unreachable' });
  });

  it('reports throttling, server failures and non-Resgrid servers', () => {
    expect(classifyLoginFailure(axiosError(429, ''))).toEqual({ code: 'rate_limited' });
    expect(classifyLoginFailure(axiosError(500, {}))).toEqual({ code: 'server_error' });
    expect(classifyLoginFailure(axiosError(503, '<html>'))).toEqual({ code: 'server_error' });
    expect(classifyLoginFailure(axiosError(400, { error: 'temporarily_unavailable' }))).toEqual({ code: 'server_error' });
    expect(classifyLoginFailure(axiosError(404, '<html>Not found</html>'))).toEqual({ code: 'server_not_resgrid' });
    expect(classifyLoginFailure(axiosError(200, '<html>'))).toEqual({ code: 'server_not_resgrid' });
  });

  it('falls back to a general failure for anything else', () => {
    expect(classifyLoginFailure(axiosError(400, { error: 'invalid_client' }))).toEqual({ code: 'login_failed' });
    expect(classifyLoginFailure(new Error('boom'))).toEqual({ code: 'login_failed' });
    expect(classifyLoginFailure(null)).toEqual({ code: 'login_failed' });
  });
});

describe('isLoginErrorCode', () => {
  it('accepts only login failure codes', () => {
    for (const code of ALL_CODES) {
      expect(isLoginErrorCode(code)).toBe(true);
    }
    expect(isLoginErrorCode('invalid_totp')).toBe(false);
    expect(isLoginErrorCode('Request failed with status code 400')).toBe(false);
    expect(isLoginErrorCode(null)).toBe(false);
  });
});

describe('isServerLoginReason', () => {
  it('accepts only the reasons a server sends', () => {
    expect(isServerLoginReason('account_locked_out')).toBe(true);
    expect(isServerLoginReason('server_unreachable')).toBe(false);
    expect(isServerLoginReason('mysecretpassword')).toBe(false);
    expect(isServerLoginReason(42)).toBe(false);
  });
});

describe('describeLoginFailure', () => {
  const t = jest.fn((key: string, options?: Record<string, unknown>) => `${key}${options ? JSON.stringify(options) : ''}`) as unknown as TFunction;

  it('passes the lockout minutes and server name to the guidance', () => {
    const result = describeLoginFailure(t, { code: 'account_locked_out', lockoutMinutes: 7 }, 'US West');
    expect(result.title).toBe('login.errors.account_locked_out.title');
    expect(result.message).toBe('login.errors.account_locked_out.message{"minutes":7,"server":"US West"}');
  });

  it('sends a lockout with no end to the administrator instead of a wait', () => {
    expect(describeLoginFailure(t, { code: 'account_locked_out' }, 'US West').title).toBe('login.errors.account_locked.title');
  });
});

describe('login error translations', () => {
  const languages = { ar, de, el, en, es, fr, it: itLang, pl, sv, uk } as Record<string, any>;

  it.each(Object.keys(languages))('%s has a title and message for every failure', (language) => {
    const errors = languages[language].login.errors;
    for (const key of [...ALL_CODES, 'account_locked']) {
      expect(errors[key]?.title).toEqual(expect.any(String));
      expect(errors[key]?.message).toEqual(expect.any(String));
    }
    expect(errors.account_locked_out.message).toContain('{{minutes}}');
    expect(errors.server_unreachable.message).toContain('{{server}}');
  });

  it.each(Object.keys(languages))('%s names every login server', (language) => {
    const server = languages[language].login.server;
    for (const key of ['label', 'us_west', 'eu_central', 'custom_host', 'signing_in_to', 'change_hint']) {
      expect(server[key]).toEqual(expect.any(String));
    }
    expect(server.custom_host).toContain('{{host}}');
  });
});
