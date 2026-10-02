import { headerSafe } from '../client-app';
import { endsTransaction, toMfaProblem } from '../errors';
import { isMfaErrorCode, mfaErrorKey } from '../messages';
import { parseMethods, parseUtc } from '../types';

describe('parseMethods', () => {
  it('reads the token endpoint string and the Sso/Redeem array alike, dropping unknown names', () => {
    expect(parseMethods('totp passkey  passkey_approval federated')).toEqual(['totp', 'passkey', 'passkey_approval', 'federated']);
    expect(parseMethods(['passkey', 'sms', 'totp'])).toEqual(['passkey', 'totp']);
    expect(parseMethods(undefined)).toEqual([]);
    expect(parseMethods(42)).toEqual([]);
  });
});

describe('parseUtc', () => {
  it('reads a zoneless server time as UTC and keeps an explicit zone', () => {
    expect(parseUtc('2026-09-29T12:00:00.0000000')).toBe(Date.parse('2026-09-29T12:00:00Z'));
    expect(parseUtc('2026-09-29T12:00:00Z')).toBe(Date.parse('2026-09-29T12:00:00Z'));
    expect(parseUtc('2026-09-29T12:00:00+02:00')).toBe(Date.parse('2026-09-29T10:00:00Z'));
    expect(parseUtc(null)).toBeNull();
    expect(parseUtc('not a date')).toBeNull();
  });
});

describe('toMfaProblem', () => {
  it('prefers the ProblemDetails type, then the OAuth error, and keeps a lock version', () => {
    expect(toMfaProblem({ response: { status: 401, data: { type: 'invalid_totp', title: 'x' } } })).toEqual({ code: 'invalid_totp', status: 401 });
    expect(toMfaProblem({ response: { status: 400, data: { error: 'mfa_transaction_expired' } } })).toEqual({ code: 'mfa_transaction_expired', status: 400 });
    expect(toMfaProblem({ response: { status: 401, data: { error: 'shared_session_locked', lock_version: 7 } } })).toEqual({
      code: 'shared_session_locked',
      status: 401,
      lockVersion: 7,
    });
  });

  it('treats a missing response as a network problem and an unreadable body as unknown', () => {
    expect(toMfaProblem(new Error('Network Error'))).toEqual({ code: 'network_error', status: null });
    expect(toMfaProblem({ response: { status: 500, data: 'oops' } })).toEqual({ code: 'unknown_error', status: 500 });
  });

  it('ends the sign-in only for the codes that cannot be retried', () => {
    for (const code of ['mfa_transaction_invalid', 'mfa_transaction_expired', 'too_many_attempts', 'policy_changed', 'session_revoked']) {
      expect(endsTransaction({ code, status: 400 })).toBe(true);
    }
    for (const code of ['invalid_totp', 'passkey_verification_failed', 'approval_denied', 'network_error']) {
      expect(endsTransaction({ code, status: 400 })).toBe(false);
    }
  });
});

describe('mfaErrorKey', () => {
  it('names known codes and falls back for anything else, never showing a raw code', () => {
    expect(mfaErrorKey('invalid_totp')).toBe('mfa.errors.invalid_totp');
    expect(mfaErrorKey('something_new')).toBe('mfa.errors.unknown_error');
    expect(mfaErrorKey(null)).toBe('mfa.errors.unknown_error');
    expect(isMfaErrorCode('policy_changed')).toBe(true);
    expect(isMfaErrorCode('Network request failed')).toBe(false);
  });
});

describe('headerSafe', () => {
  it('keeps a label printable, trimmed and bounded, so the HTTP stack can send it', () => {
    expect(headerSafe('  Engine 7 iPad  ')).toBe('Engine 7 iPad');
    expect(headerSafe('Shawn’s iPhone 🚒')).toBe('Shawns iPhone');
    expect(headerSafe('x'.repeat(100))).toHaveLength(64);
    expect(headerSafe('🚒')).toBeNull();
    expect(headerSafe(null)).toBeNull();
  });
});
