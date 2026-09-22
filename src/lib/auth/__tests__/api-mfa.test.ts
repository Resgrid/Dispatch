import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { logger } from '@/lib/logging';

import { externalTokenRequest, loginRequest, retrySsoExchangeWithOtp } from '../api';

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const client = actual.default.create();
  client.post = jest.fn();
  return { ...actual, __esModule: true, default: { ...actual.default, create: () => client } };
});

const post = axios.create().post as jest.Mock;

const oauthError = (error: string): AxiosError =>
  new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', { url: '/connect/token' } as InternalAxiosRequestConfig, undefined, {
    status: 400,
    data: { error, error_description: 'secret-description' },
  } as AxiosResponse);

const tokens = { access_token: 'access-secret', refresh_token: 'refresh-secret', id_token: 'id', expires_in: 3600, token_type: 'Bearer', expiration_date: '' };

const allLogs = () => JSON.stringify([...(logger.info as jest.Mock).mock.calls, ...(logger.warn as jest.Mock).mock.calls, ...(logger.error as jest.Mock).mock.calls]);

// The token endpoint answers a 2FA challenge with an OAuth error rather than a distinct status, so
// the api layer is what turns that into a state the login screens can act on. These cover that
// mapping and the retained SSO exchange the OTP retry runs against.
describe('two-factor login handling', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loginRequest', () => {
    it('reports mfa_required as a challenge, not a failure, and logs no credentials', async () => {
      post.mockRejectedValue(oauthError('mfa_required'));

      const result = await loginRequest({ username: 'dispatcher', password: 'password-secret' });

      expect(result).toEqual({ successful: false, message: 'Two-factor authentication required', authResponse: null, mfaRequired: true, invalidOtp: false });
      expect(logger.error).not.toHaveBeenCalled();
      expect(allLogs()).not.toContain('password-secret');
    });

    it('flags a rejected code so the prompt can say so, without logging the code', async () => {
      post.mockRejectedValue(oauthError('invalid_totp'));

      const result = await loginRequest({ username: 'dispatcher', password: 'password-secret', otpCode: '123456' });

      expect(result).toMatchObject({ successful: false, mfaRequired: true, invalidOtp: true });
      expect(post.mock.calls[0][1]).toContain('totp_code=123456');
      expect(allLogs()).not.toContain('123456');
      expect(allLogs()).not.toContain('password-secret');
    });

    it('signs in on the retry that carries an accepted code', async () => {
      post.mockRejectedValueOnce(oauthError('mfa_required')).mockResolvedValueOnce({ status: 200, data: tokens });

      const challenge = await loginRequest({ username: 'dispatcher', password: 'password-secret' });
      const retry = await loginRequest({ username: 'dispatcher', password: 'password-secret', otpCode: ' 654321 ' });

      expect(challenge.mfaRequired).toBe(true);
      expect(retry).toEqual({ successful: true, message: 'Login successful', authResponse: tokens });
      // The first attempt sends no code; the retry sends the trimmed one.
      expect(post.mock.calls[0][1]).not.toContain('totp_code');
      expect(post.mock.calls[1][1]).toContain('totp_code=654321');
    });

    it('still treats any other OAuth error as a plain failure', async () => {
      post.mockRejectedValue(oauthError('invalid_grant'));

      const result = await loginRequest({ username: 'dispatcher', password: 'password-secret' });

      expect(result.successful).toBe(false);
      expect(result.mfaRequired).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Login API call failed with exception' }));
    });
  });

  describe('externalTokenRequest and retrySsoExchangeWithOtp', () => {
    it('retains the exchange on an mfa_required challenge and retries it with the code', async () => {
      post.mockRejectedValueOnce(oauthError('mfa_required')).mockResolvedValueOnce({ status: 200, data: tokens });

      const challenge = await externalTokenRequest('oidc', 'idp-token-secret', 'dispatcher', 7);
      expect(challenge).toMatchObject({ successful: false, mfaRequired: true, invalidOtp: false });

      const retry = await retrySsoExchangeWithOtp('123456');

      expect(retry).toEqual({ successful: true, message: 'SSO login successful', authResponse: tokens });
      const retryBody = post.mock.calls[1][1] as string;
      expect(retryBody).toContain('provider=oidc');
      expect(retryBody).toContain('external_token=idp-token-secret');
      expect(retryBody).toContain('department_id=7');
      expect(retryBody).toContain('totp_code=123456');
      expect(allLogs()).not.toContain('idp-token-secret');
      expect(allLogs()).not.toContain('123456');
    });

    it('keeps the exchange across a rejected code so the person can try again', async () => {
      post.mockRejectedValueOnce(oauthError('mfa_required')).mockRejectedValueOnce(oauthError('invalid_totp')).mockResolvedValueOnce({ status: 200, data: tokens });

      await externalTokenRequest('saml2', 'saml-response', 'dispatcher');
      const rejected = await retrySsoExchangeWithOtp('000000');
      const accepted = await retrySsoExchangeWithOtp('111111');

      expect(rejected).toMatchObject({ successful: false, mfaRequired: true, invalidOtp: true });
      expect(accepted.successful).toBe(true);
      expect(post).toHaveBeenCalledTimes(3);
    });

    it('drops the retained exchange once it succeeds', async () => {
      post.mockRejectedValueOnce(oauthError('mfa_required')).mockResolvedValueOnce({ status: 200, data: tokens });

      await externalTokenRequest('oidc', 'idp-token-secret', 'dispatcher');
      await retrySsoExchangeWithOtp('123456');
      const again = await retrySsoExchangeWithOtp('123456');

      expect(again).toEqual({ successful: false, message: 'No pending SSO sign-in to verify', authResponse: null });
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('drops the retained exchange after a non-MFA failure', async () => {
      // A challenge is retained; a real rejection of the IdP token must not leave it around for a
      // later code to replay.
      post.mockRejectedValueOnce(oauthError('mfa_required')).mockRejectedValueOnce(oauthError('invalid_grant'));

      await externalTokenRequest('oidc', 'idp-token-secret', 'dispatcher');
      const failed = await retrySsoExchangeWithOtp('123456');
      const again = await retrySsoExchangeWithOtp('123456');

      expect(failed).toMatchObject({ successful: false });
      expect(failed.mfaRequired).toBeUndefined();
      expect(again).toEqual({ successful: false, message: 'No pending SSO sign-in to verify', authResponse: null });
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('answers a retry with nothing pending without calling the server', async () => {
      const result = await retrySsoExchangeWithOtp('123456');

      expect(result).toEqual({ successful: false, message: 'No pending SSO sign-in to verify', authResponse: null });
      expect(post).not.toHaveBeenCalled();
    });
  });
});
