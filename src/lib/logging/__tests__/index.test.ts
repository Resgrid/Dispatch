// The logging module short-circuits all Sentry reporting when JEST_WORKER_ID is
// set, so the module is loaded below with that variable temporarily removed.

const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

// Replace the console transport so exercising the real (non-Jest) code path
// doesn't print every test's log line.
const mockTransportLog = jest.fn();
jest.mock('react-native-logs', () => ({
  consoleTransport: jest.fn(),
  logger: {
    createLogger: () => ({
      debug: mockTransportLog,
      info: mockTransportLog,
      warn: mockTransportLog,
      error: mockTransportLog,
    }),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import type { Logger } from '../types';

let logger: Logger;
let sanitizeLogContext: (context: Record<string, unknown> | undefined) => Record<string, unknown>;

beforeAll(() => {
  const workerId = process.env.JEST_WORKER_ID;
  delete process.env.JEST_WORKER_ID;
  jest.isolateModules(() => {
    const loggingModule = require('../index');
    logger = loggingModule.logger;
    sanitizeLogContext = loggingModule.sanitizeLogContext;
  });
  process.env.JEST_WORKER_ID = workerId;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LogService#error Sentry reporting', () => {
  it('reports an Error as an exception so Sentry groups by the real stack', () => {
    const error = new Error('Config fetch failed');
    error.stack = 'Error: Config fetch failed\n    at fetchConfig (core-store.ts:307:31)';

    logger.error({ message: 'Failed to initialize app', context: { error } });

    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    const [captured] = mockCaptureException.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured.name).toBe('Error');
    expect(captured.message).toBe('Config fetch failed');
    expect(captured.stack).toBe(error.stack);
  });

  it('preserves a custom error name so the issue title is the real exception type', () => {
    const error = new Error('Network Error');
    error.name = 'AxiosError';

    logger.error({ message: 'Failed to send location to API', context: { error } });

    expect(mockCaptureException.mock.calls[0][0].name).toBe('AxiosError');
  });

  it('does not forward the original error object to Sentry', () => {
    // captureException serializes an error's own enumerable properties into the
    // event; an AxiosError carries config.data with urlencoded credentials.
    const axiosError = Object.assign(new Error('Request failed with status code 400'), {
      name: 'AxiosError',
      isAxiosError: true,
      code: 'ERR_BAD_REQUEST',
      config: { method: 'post', url: '/Connect/token', data: 'password=hunter2&grant_type=password' },
      response: { status: 400 },
    });

    logger.error({ message: 'Failed to send location to API', context: { error: axiosError } });

    const [captured] = mockCaptureException.mock.calls[0];
    expect(captured).not.toBe(axiosError);
    expect(captured).not.toHaveProperty('config');
    expect(captured).not.toHaveProperty('response');
    expect(JSON.stringify(captured)).not.toContain('hunter2');
  });

  it('still attaches the sanitized context as extra data', () => {
    const axiosError = Object.assign(new Error('Request failed with status code 400'), {
      name: 'AxiosError',
      isAxiosError: true,
      code: 'ERR_BAD_REQUEST',
      config: { method: 'post', url: '/UnitLocation/SetUnitLocation?key=abc' },
      response: { status: 400 },
    });

    logger.error({ message: 'Failed to send location to API', context: { error: axiosError, unitId: 'unit-123' } });

    const [, options] = mockCaptureException.mock.calls[0];
    expect(options.extra).toEqual(
      expect.objectContaining({
        message: 'Failed to send location to API',
        unitId: 'unit-123',
        error: expect.objectContaining({
          name: 'AxiosError',
          code: 'ERR_BAD_REQUEST',
          status: 400,
          url: '/UnitLocation/SetUnitLocation',
          isAxiosError: true,
        }),
      })
    );
  });

  it('falls back to captureMessage when the context holds no Error', () => {
    logger.error({ message: 'Token refresh rejected by server', context: { error: 'invalid_grant' } });

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith('Token refresh rejected by server', { level: 'error', extra: { error: 'invalid_grant' } });
  });

  it('falls back to captureMessage when there is no context at all', () => {
    logger.error({ message: 'Something went wrong' });

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith('Something went wrong', { level: 'error', extra: {} });
  });

  it('includes operation and trace_id in the reported extra data', () => {
    logger.error({ message: 'Request failed', operation: 'token_refresh', trace_id: 'abc123' });

    expect(mockCaptureMessage).toHaveBeenCalledWith('Request failed', { level: 'error', extra: { operation: 'token_refresh', trace_id: 'abc123' } });
  });

  it('does not report warn, info or debug to Sentry', () => {
    logger.warn({ message: 'Failed to send location to API', context: { error: new Error('Network Error') } });
    logger.info({ message: 'Location successfully sent to API' });
    logger.debug({ message: 'Skipping location API call' });

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});

describe('LogService console transport', () => {
  it('redacts the context before it reaches the device console', () => {
    const axiosError = Object.assign(new Error('Request failed with status code 400'), {
      name: 'AxiosError',
      isAxiosError: true,
      config: { method: 'post', url: '/Connect/token', data: 'password=hunter2&grant_type=password' },
      response: { status: 400 },
    });

    logger.warn({ message: 'Sign-in failed', operation: 'login', context: { error: axiosError, accessToken: 'abc', unitId: 'unit-123' } });

    expect(mockTransportLog).toHaveBeenCalledTimes(1);
    const [message, context] = mockTransportLog.mock.calls[0];
    expect(message).toBe('Sign-in failed');
    expect(context).toEqual(
      expect.objectContaining({
        accessToken: '[REDACTED]',
        unitId: 'unit-123',
        operation: 'login',
        error: expect.objectContaining({ name: 'AxiosError', status: 400, url: '/Connect/token' }),
      })
    );
    expect(JSON.stringify(context)).not.toContain('hunter2');
  });
});

describe('sanitizeLogContext', () => {
  it('redacts sensitive keys', () => {
    expect(sanitizeLogContext({ accessToken: 'abc', refresh_token: 'def', unitId: 'unit-123' })).toEqual({
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      unitId: 'unit-123',
    });
  });

  it('redacts usernames and a bare auth key, but not words that merely start with "auth"', () => {
    expect(sanitizeLogContext({ username: 'pat@example.com', auth: 'secret', authority: 'https://idp.example.com', author: 'Pat' })).toEqual({
      username: '[REDACTED]',
      auth: '[REDACTED]',
      authority: 'https://idp.example.com',
      author: 'Pat',
    });
  });

  it('reduces an axios error to a summary without the request body', () => {
    const axiosError = Object.assign(new Error('Request failed with status code 401'), {
      name: 'AxiosError',
      isAxiosError: true,
      code: 'ERR_BAD_REQUEST',
      config: { method: 'post', url: '/Connect/token?x=1', baseURL: 'https://api.resgrid.com/api/v4', data: 'password=hunter2' },
      response: { status: 401 },
    });

    expect(sanitizeLogContext({ error: axiosError })).toEqual({
      error: {
        name: 'AxiosError',
        message: 'Request failed with status code 401',
        code: 'ERR_BAD_REQUEST',
        status: 401,
        method: 'post',
        url: '/Connect/token',
        baseURL: 'https://api.resgrid.com/api/v4',
        isAxiosError: true,
      },
    });
  });

  it('expands a plain Error, whose properties are non-enumerable', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at somewhere';

    expect(sanitizeLogContext({ error })).toEqual({
      error: { name: 'Error', message: 'boom', stack: 'Error: boom\n    at somewhere' },
    });
  });
});
