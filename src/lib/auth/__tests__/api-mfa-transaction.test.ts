import queryString from 'query-string';

const mockPost = jest.fn();

jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4' }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@env', () => ({ Env: { IS_MOBILE_APP: true } }));
jest.mock('axios', () => ({
  __esModule: true,
  // Dispatch's error sanitizer checks `instanceof AxiosError`.
  AxiosError: class AxiosError extends Error {},
  default: { create: jest.fn(() => ({ defaults: {}, interceptors: { request: { use: jest.fn() } }, post: mockPost })) },
}));

// Required after the mocks exist: the module creates its axios instance at load.
const { completionGrantRequest, loginRequest } = require('../api') as typeof import('../api');

const refusal = (data: Record<string, unknown>) => Object.assign(new Error('400'), { response: { status: 400, data } });
const sentBody = () => queryString.parse(mockPost.mock.calls[0][1] as string);

describe('login on the transaction flow (passkey workbook section 7.1)', () => {
  beforeEach(() => mockPost.mockReset());

  it('asks for the transaction flow and never sends a code with the password', async () => {
    mockPost.mockResolvedValue({ status: 200, data: { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 60 } });
    await loginRequest({ username: 'user1', password: 'pw' });
    expect(mockPost.mock.calls[0][0]).toBe('/connect/token');
    expect(sentBody()).toMatchObject({ grant_type: 'password', username: 'user1', password: 'pw', mfa_flow: 'transaction' });
    expect(sentBody().totp_code).toBeUndefined();
  });

  it('continues on the transaction the server started, with its methods and lifetime', async () => {
    mockPost.mockRejectedValue(
      refusal({ error: 'mfa_required', mfa_transaction: 'secret', mfa_methods: 'totp passkey federated', mfa_enrolled: 'totp passkey', mfa_preferred: 'passkey', mfa_expires_in: 300 })
    );
    const before = Date.now();
    const response = await loginRequest({ username: 'user1', password: 'pw' });

    expect(response.successful).toBe(false);
    expect(response.mfaTransaction?.secret).toBe('secret');
    expect(response.mfaTransaction?.challenge).toMatchObject({
      kind: 'verify',
      methods: ['totp', 'passkey', 'federated'],
      enrolled: ['totp', 'passkey'],
      preferred: 'passkey',
      source: 'password',
    });
    expect(response.mfaTransaction?.challenge.expiresAt).toBeGreaterThanOrEqual(before + 300000);
  });

  it('falls back to the code resent with the password when the server has no transaction', async () => {
    mockPost.mockRejectedValueOnce(refusal({ error: 'mfa_required' }));
    const first = await loginRequest({ username: 'user1', password: 'pw' });
    expect(first).toMatchObject({ mfaRequired: true, invalidOtp: false });
    expect(first.mfaTransaction).toBeUndefined();

    mockPost.mockReset();
    mockPost.mockRejectedValueOnce(refusal({ error: 'invalid_totp' }));
    const second = await loginRequest({ username: 'user1', password: 'pw', otpCode: ' 123456 ' });
    expect(sentBody()).toMatchObject({ totp_code: '123456' });
    expect(sentBody().mfa_flow).toBeUndefined();
    expect(second).toMatchObject({ mfaRequired: true, invalidOtp: true });
  });

  it('continues as the setup transaction when the department requires MFA the account does not have', async () => {
    mockPost.mockRejectedValueOnce(refusal({ error: 'mfa_enrollment_required', mfa_setup_transaction: 'setup-secret', mfa_expires_in: 300 }));
    const setup = await loginRequest({ username: 'user1', password: 'pw' });
    expect(setup.mfaTransaction).toMatchObject({ secret: 'setup-secret', challenge: { kind: 'setup', methods: ['totp'] } });

    mockPost.mockRejectedValueOnce(refusal({ error: 'mfa_enrollment_required', error_uri: 'https://app/User/TwoFactor' }));
    expect(await loginRequest({ username: 'user1', password: 'pw' })).toMatchObject({ successful: false, enrollmentRequired: true });
  });

  it('exchanges the completion code once for tokens', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 60 } });
    expect(await completionGrantRequest('secret', 'code-1')).toMatchObject({ access_token: 'a' });
    expect(sentBody()).toEqual({ grant_type: 'urn:resgrid:params:oauth:grant-type:mfa_completion', transaction: 'secret', completion_code: 'code-1' });
  });
});
