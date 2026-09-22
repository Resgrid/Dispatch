// Mock the API
jest.mock('@/api/data-protection/data-protection', () => ({
  getDataProtectionCapabilities: jest.fn(),
  requestProtectedGrant: jest.fn(),
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

jest.mock('../../auth/store', () => ({
  __esModule: true,
  default: {
    subscribe: () => () => {},
    getState: jest.fn(),
  },
}));

import { dataProtectionStore } from '../store';

const { requestProtectedGrant, verifyStepUp } = require('@/api/data-protection/data-protection');

const inTenMinutes = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

const problem = (type: string) => Object.assign(new Error(type), { response: { data: { type } } });

/**
 * A department can release named apps from the step-up prompt (ADP plan 3.3), because a
 * dispatcher on a live incident cannot stop to read a code off a phone.
 *
 * The client never decides that. It asks the server, and every uncertain answer resolves towards
 * showing the prompt — the direction that cannot cause harm.
 */
describe('dataProtectionStore grant acquisition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataProtectionStore.setState({
      capabilities: null,
      isCapabilitiesLoaded: false,
      stepUpExpiresAt: null,
      grantToken: null,
      isVerifying: false,
      isRequestingGrant: false,
      lastError: null,
    });
  });

  it('takes the grant when this app is exempt', async () => {
    requestProtectedGrant.mockResolvedValue({
      GrantToken: 'grant-abc',
      StepUpExpiresOnUtc: inTenMinutes(),
    });

    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('granted');
    expect(dataProtectionStore.getState().grantToken).toBe('grant-abc');
    expect(dataProtectionStore.getState().isStepUpActive()).toBe(true);
  });

  it('asks for a code when this app is not exempt', async () => {
    requestProtectedGrant.mockRejectedValue(problem('step_up_required'));

    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('step_up_required');
    expect(dataProtectionStore.getState().grantToken).toBeNull();
  });

  it('asks for a code when the request fails for any other reason', async () => {
    // A network failure must not silently reveal anything, and must not leave the member with a
    // button that does nothing either.
    requestProtectedGrant.mockRejectedValue(new Error('offline'));

    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('step_up_required');
  });

  it('reports grants being unconfigured separately from needing a code', async () => {
    requestProtectedGrant.mockRejectedValue(problem('grants_not_configured'));

    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('unavailable');
  });

  it('asks for a code when the server answers without a usable grant', async () => {
    // A 200 carrying no token, or one that has already expired, is not a grant.
    requestProtectedGrant.mockResolvedValue({ GrantToken: null, StepUpExpiresOnUtc: inTenMinutes() });
    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('step_up_required');

    requestProtectedGrant.mockResolvedValue({
      GrantToken: 'grant-abc',
      StepUpExpiresOnUtc: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('step_up_required');
    expect(dataProtectionStore.getState().grantToken).toBeNull();
  });

  it('does not ask again while a grant is already held', async () => {
    dataProtectionStore.setState({
      grantToken: 'grant-abc',
      stepUpExpiresAt: Date.now() + 60000,
    });

    await expect(dataProtectionStore.getState().ensureGrant()).resolves.toBe('granted');
    expect(requestProtectedGrant).not.toHaveBeenCalled();
  });

  it('keeps the grant from a verified code', async () => {
    verifyStepUp.mockResolvedValue({
      GrantToken: 'grant-from-otp',
      StepUpExpiresOnUtc: inTenMinutes(),
    });

    await expect(dataProtectionStore.getState().verifyOtp('123456')).resolves.toBe(true);
    expect(dataProtectionStore.getState().grantToken).toBe('grant-from-otp');
  });
});

describe('dataProtectionStore grant headers', () => {
  beforeEach(() => {
    dataProtectionStore.setState({ stepUpExpiresAt: null, grantToken: null });
  });

  it('sends nothing when no grant is held', () => {
    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
  });

  it('sends the grant while it is live', () => {
    dataProtectionStore.setState({ grantToken: 'grant-abc', stepUpExpiresAt: Date.now() + 60000 });

    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({
      'X-Resgrid-Protected-Grant': 'grant-abc',
    });
  });

  it('stops sending a grant that lapsed while the screen sat open', () => {
    // Expiry is re-checked at the moment of use rather than trusted from state, so a screen left
    // open past the window cannot attach a dead grant to its next request.
    dataProtectionStore.setState({ grantToken: 'grant-abc', stepUpExpiresAt: Date.now() - 1 });

    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
  });

  it('sends nothing after concealing', () => {
    dataProtectionStore.setState({ grantToken: 'grant-abc', stepUpExpiresAt: Date.now() + 60000 });
    dataProtectionStore.getState().clearStepUp();

    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
    expect(dataProtectionStore.getState().grantToken).toBeNull();
  });
});
