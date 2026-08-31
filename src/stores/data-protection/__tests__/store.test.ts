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

import { dataProtectionStore } from '../store';

const { getDataProtectionCapabilities, verifyStepUp } = require('@/api/data-protection/data-protection');

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
