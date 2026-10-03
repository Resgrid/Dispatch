const mockPost = jest.fn();
let mockInterceptor: ((config: { headers: Record<string, string>; baseURL?: string }) => unknown) | null = null;

jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4' }));
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      interceptors: { request: { use: (fn: typeof mockInterceptor) => (mockInterceptor = fn) } },
      post: mockPost,
    })),
  },
}));

// Required after the mocks exist: the module creates its axios instance at load.
const { completePasskey, completeTotp, requestLoginApproval, ssoBegin, ssoRedeem } = require('../transaction-api') as typeof import('../transaction-api');

describe('sign-in transaction calls', () => {
  beforeEach(() => mockPost.mockReset().mockResolvedValue({ data: { Data: { CompletionCode: 'c' } } }));

  it('sends PascalCase bodies (snake_case never binds on the server) and returns the Data payload', async () => {
    expect(await completeTotp('secret', '123456')).toEqual({ CompletionCode: 'c' });
    expect(mockPost).toHaveBeenCalledWith('/Authentication/CompleteTotp', { Transaction: 'secret', Code: '123456' });

    await completePasskey('secret', 'req-1', { id: 'cred' });
    expect(mockPost).toHaveBeenLastCalledWith('/Authentication/CompletePasskey', { Transaction: 'secret', RequestId: 'req-1', Credential: { id: 'cred' } });

    await requestLoginApproval('secret');
    expect(mockPost).toHaveBeenLastCalledWith('/MfaApproval/Request', { Purpose: 'login', Transaction: 'secret' });

    await ssoBegin({ Purpose: 'login', ReturnTarget: 'resgrid://sso-return', State: 's', CodeChallenge: 'c', Platform: 'ios', Username: 'user1' });
    expect(mockPost).toHaveBeenLastCalledWith('/Sso/Begin', expect.objectContaining({ Purpose: 'login', CodeChallengeMethod: 'S256', Username: 'user1' }));

    await ssoRedeem('sso-1', 'code-1', 'verifier');
    expect(mockPost).toHaveBeenLastCalledWith('/Sso/Redeem', { SsoTransactionId: 'sso-1', SsoCode: 'code-1', CodeVerifier: 'verifier' });
  });

  it('binds every call to this app and base address, with no bearer token', () => {
    const config = mockInterceptor!({ headers: {} }) as { headers: Record<string, string>; baseURL: string };
    expect(config.baseURL).toBe('https://api.test/api/v4');
    expect(config.headers['X-Resgrid-Client']).toBe('dispatch');
    expect(config.headers.Authorization).toBeUndefined();
  });
});
