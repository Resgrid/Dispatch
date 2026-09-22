// Mock the API
jest.mock('@/api/data-protection/data-protection', () => ({
  getDataProtectionCapabilities: jest.fn(),
  verifyStepUp: jest.fn(),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Capture the auth-store subscription the store registers at module load.
// eslint-disable-next-line no-var
var mockAuthListener: ((state: { status: string }, prevState: { status: string }) => void) | undefined;
jest.mock('../../auth/store', () => ({
  __esModule: true,
  default: {
    subscribe: (listener: (state: { status: string }, prevState: { status: string }) => void) => {
      mockAuthListener = listener;
      return () => {};
    },
    getState: jest.fn(),
  },
}));

import { logger } from '@/lib/logging';

import { dataProtectionStore } from '../store';

const { getDataProtectionCapabilities, verifyStepUp } = require('@/api/data-protection/data-protection');

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('dataProtectionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataProtectionStore.setState({
      capabilities: null,
      isCapabilitiesLoaded: false,
      stepUpExpiresAt: null,
      isVerifying: false,
      lastError: null,
    });
  });

  describe('fetchCapabilities', () => {
    it('stores the department capability report', async () => {
      getDataProtectionCapabilities.mockResolvedValue({
        Data: { IsProtectionEnabled: true, StepUpWindowMinutes: 30, IsDepartmentLocked: false },
      });

      await dataProtectionStore.getState().fetchCapabilities();

      const state = dataProtectionStore.getState();
      expect(state.isCapabilitiesLoaded).toBe(true);
      expect(state.capabilities?.isProtectionEnabled).toBe(true);
      expect(state.capabilities?.stepUpWindowMinutes).toBe(30);
    });

    it('marks loaded without capabilities on failure', async () => {
      getDataProtectionCapabilities.mockRejectedValue(new Error('network'));

      await dataProtectionStore.getState().fetchCapabilities();

      const state = dataProtectionStore.getState();
      expect(state.isCapabilitiesLoaded).toBe(true);
      expect(state.capabilities).toBeNull();
    });

    it('logs only the status of a failed request, never the request itself', async () => {
      // The shared client attaches the grant header to this request whenever one is held, and the
      // raw Axios error carries that config; the logger forwards context to Sentry as-is.
      const error = Object.assign(new Error('Request failed'), {
        config: { headers: { 'X-Resgrid-Protected-Grant': 'grant-secret' } },
        response: { status: 503, data: { type: 'server_error' } },
      });
      getDataProtectionCapabilities.mockRejectedValue(error);

      await dataProtectionStore.getState().fetchCapabilities();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to fetch data protection capabilities',
        context: { status: 503, errorType: 'server_error' },
      });
      expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('grant-secret');
    });

    it('drops a capability response that lands after sign-out', async () => {
      const pending = deferred<{ Data: { IsProtectionEnabled: boolean } }>();
      getDataProtectionCapabilities.mockReturnValue(pending.promise);

      const fetching = dataProtectionStore.getState().fetchCapabilities();
      mockAuthListener?.({ status: 'signedOut' }, { status: 'signedIn' });
      pending.resolve({ Data: { IsProtectionEnabled: true } });
      await fetching;

      const state = dataProtectionStore.getState();
      expect(state.capabilities).toBeNull();
      expect(state.isCapabilitiesLoaded).toBe(false);
    });
  });

  describe('verifyOtp', () => {
    it('activates the absolute window on success', async () => {
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      verifyStepUp.mockResolvedValue({ GrantToken: 'grant-token', StepUpExpiresOnUtc: expires, StepUpWindowMinutes: 15 });

      const ok = await dataProtectionStore.getState().verifyOtp('123456');

      expect(ok).toBe(true);
      expect(verifyStepUp).toHaveBeenCalledWith('123456');
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(true);
      expect(dataProtectionStore.getState().lastError).toBeNull();
    });

    it('maps the server problem type on failure and stays locked', async () => {
      verifyStepUp.mockRejectedValue({ response: { data: { type: 'invalid_totp' } } });

      const ok = await dataProtectionStore.getState().verifyOtp('000000');

      expect(ok).toBe(false);
      expect(dataProtectionStore.getState().lastError).toBe('invalid_totp');
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
    });

    it('rejects an already-expired window from the server', async () => {
      verifyStepUp.mockResolvedValue({ GrantToken: 'grant-token', StepUpExpiresOnUtc: new Date(Date.now() - 1000).toISOString() });

      const ok = await dataProtectionStore.getState().verifyOtp('123456');

      expect(ok).toBe(false);
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
    });

    it('discards a grant that arrives after sign-out instead of restoring it', async () => {
      // The sign-out sweep runs while the verification is in flight; the token that then arrives
      // belongs to the ended session and must not be attached to the next one's requests.
      const pending = deferred<{ GrantToken: string; StepUpExpiresOnUtc: string }>();
      verifyStepUp.mockReturnValue(pending.promise);

      const verifying = dataProtectionStore.getState().verifyOtp('123456');
      mockAuthListener?.({ status: 'signedOut' }, { status: 'signedIn' });
      pending.resolve({ GrantToken: 'stale-token', StepUpExpiresOnUtc: new Date(Date.now() + 15 * 60 * 1000).toISOString() });

      await expect(verifying).resolves.toBe(false);
      expect(dataProtectionStore.getState().grantToken).toBeNull();
      expect(dataProtectionStore.getState().isVerifying).toBe(false);
      expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
    });

    it('rejects a verification response that carries no grant token', async () => {
      // Accepting one would report the value as revealed while every request goes out without the
      // grant header, so the data stays redacted with no error to explain it.
      verifyStepUp.mockResolvedValue({ StepUpExpiresOnUtc: new Date(Date.now() + 15 * 60 * 1000).toISOString() });

      const ok = await dataProtectionStore.getState().verifyOtp('123456');

      expect(ok).toBe(false);
      expect(dataProtectionStore.getState().lastError).toBe('unknown');
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
      expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
    });
  });

  describe('window lifecycle', () => {
    it('expires by wall clock — the window is absolute, never sliding', () => {
      dataProtectionStore.setState({ grantToken: 'grant-token', stepUpExpiresAt: Date.now() - 1 });
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);

      dataProtectionStore.setState({ grantToken: 'grant-token', stepUpExpiresAt: Date.now() + 60_000 });
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(true);

      dataProtectionStore.setState({ grantToken: null, stepUpExpiresAt: Date.now() + 60_000 });
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
      expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
    });

    it('drops the grant on its own when the window ends', async () => {
      // A screen that sits open past expiry re-renders off this, so its plaintext and "Hide again"
      // control go away without anyone touching it.
      jest.useFakeTimers();
      try {
        verifyStepUp.mockResolvedValue({ GrantToken: 'grant-token', StepUpExpiresOnUtc: new Date(Date.now() + 60_000).toISOString() });

        await dataProtectionStore.getState().verifyOtp('123456');
        expect(dataProtectionStore.getState().grantToken).toBe('grant-token');

        jest.advanceTimersByTime(59_000);
        expect(dataProtectionStore.getState().grantToken).toBe('grant-token');

        jest.advanceTimersByTime(1_500);
        expect(dataProtectionStore.getState().grantToken).toBeNull();
        expect(dataProtectionStore.getState().stepUpExpiresAt).toBeNull();
        expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
      } finally {
        jest.useRealTimers();
      }
    });

    it('a manual conceal cancels the expiry timer so it cannot clear a later grant', async () => {
      jest.useFakeTimers();
      try {
        verifyStepUp.mockResolvedValueOnce({ GrantToken: 'first', StepUpExpiresOnUtc: new Date(Date.now() + 60_000).toISOString() });
        await dataProtectionStore.getState().verifyOtp('111111');
        dataProtectionStore.getState().clearStepUp();
        expect(jest.getTimerCount()).toBe(0);

        verifyStepUp.mockResolvedValueOnce({ GrantToken: 'second', StepUpExpiresOnUtc: new Date(Date.now() + 120_000).toISOString() });
        await dataProtectionStore.getState().verifyOtp('222222');

        jest.advanceTimersByTime(61_000);
        expect(dataProtectionStore.getState().grantToken).toBe('second');

        jest.advanceTimersByTime(60_000);
        expect(dataProtectionStore.getState().grantToken).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('clearStepUp drops the window immediately', () => {
      dataProtectionStore.setState({ grantToken: 'grant-token', stepUpExpiresAt: Date.now() + 60_000 });
      dataProtectionStore.getState().clearStepUp();
      expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
    });

    it('signing out drops everything — the grant is memory-only', () => {
      dataProtectionStore.setState({
        stepUpExpiresAt: Date.now() + 60_000,
        capabilities: { isProtectionEnabled: true, stepUpWindowMinutes: 15, isDepartmentLocked: false, lockReason: null },
        isCapabilitiesLoaded: true,
      });

      expect(mockAuthListener).toBeDefined();
      mockAuthListener?.({ status: 'signedOut' }, { status: 'signedIn' });

      const state = dataProtectionStore.getState();
      expect(state.stepUpExpiresAt).toBeNull();
      expect(state.capabilities).toBeNull();
      expect(state.isCapabilitiesLoaded).toBe(false);
    });
  });
});
