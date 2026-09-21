import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { logger } from '@/lib/logging';

import { refreshTokenRequest } from '../api';

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const client = actual.default.create();
  client.post = jest.fn();
  return { ...actual, __esModule: true, default: { ...actual.default, create: () => client } };
});

const post = axios.create().post as jest.Mock;

describe('token endpoint diagnostics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records recognized OAuth error details without credentials or raw response data', async () => {
    const error = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', { url: '/connect/token?secret=request-secret' } as InternalAxiosRequestConfig, undefined, {
      status: 400,
      data: {
        error: 'invalid_grant',
        error_description: 'The refresh token is no longer valid.',
        error_uri: 'https://documentation.openiddict.com/errors/ID2004',
        refresh_token: 'response-secret',
      },
    } as AxiosResponse);
    post.mockRejectedValue(error);

    await expect(refreshTokenRequest('refresh-secret')).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Token refresh request failed',
      context: {
        message: error.message,
        status: 400,
        url: '/connect/token',
        oauthError: 'invalid_grant',
        oauthErrorId: 'ID2004',
        rejectionReason: 'refresh_token_no_longer_valid',
      },
    });
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain('secret');
  });

  it('omits arbitrary server error text and URLs', async () => {
    const error = new AxiosError('Rejected', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      data: { error: 'secret', error_description: 'secret', error_uri: 'https://example.com/secret' },
    } as AxiosResponse);
    post.mockRejectedValue(error);

    await expect(refreshTokenRequest('refresh-secret')).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith({ message: 'Token refresh request failed', context: { message: 'Rejected', status: 400, url: undefined } });
  });
});
