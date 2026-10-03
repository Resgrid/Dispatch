jest.mock('@/api/data-protection/data-protection', () => ({
  getDataProtectionCapabilities: jest.fn(),
  requestProtectedGrant: jest.fn(),
  verifyStepUp: jest.fn(),
  getStepUpMethods: jest.fn(),
  getStepUpPasskeyOptions: jest.fn(),
  verifyStepUpPasskey: jest.fn(),
  requestStepUpApproval: jest.fn(),
  getStepUpApprovalStatus: jest.fn(),
  cancelStepUpApproval: jest.fn(),
  completeStepUpApproval: jest.fn(),
  beginStepUpSso: jest.fn(),
  completeStepUpFederated: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/mfa/passkey', () => ({ getPasskeyAssertion: jest.fn(), passkeysSupported: jest.fn(() => true) }));
jest.mock('@/lib/mfa/sso-browser', () => ({ runSsoRoundTrip: jest.fn() }));

import * as api from '@/api/data-protection/data-protection';
import { getPasskeyAssertion, passkeysSupported } from '@/lib/mfa/passkey';
import { PasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';

import { markSharedSessionLocked, resetSharedSession } from '@/stores/shared-session/store';

import { dataProtectionStore } from '../store';

const mocked = api as jest.Mocked<typeof api>;
const grant = () => ({ GrantId: 'g', GrantToken: 'token-1', StepUpExpiresOnUtc: new Date(Date.now() + 10 * 60 * 1000).toISOString(), StepUpWindowMinutes: 15 });
const problem = (status: number, type: string) => Object.assign(new Error(type), { response: { status, data: { type } } });

describe('protected data by every step-up method (passkey plan section 8.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataProtectionStore.setState({ grantToken: null, stepUpExpiresAt: null, lastError: null, stepUpMethods: null, preferredStepUpMethod: null });
  });

  it('lists the member\'s methods, hides passkeys this device cannot use, and falls back to the code on an older server', async () => {
    mocked.getStepUpMethods.mockResolvedValueOnce({ Methods: ['passkey', 'totp', 'passkey_approval'], Preferred: 'passkey', EnrolledMethods: [], AllowedMethods: [] });
    await dataProtectionStore.getState().loadStepUpMethods();
    expect(dataProtectionStore.getState().stepUpMethods).toEqual(['passkey', 'totp', 'passkey_approval']);

    (passkeysSupported as jest.Mock).mockReturnValueOnce(false);
    mocked.getStepUpMethods.mockResolvedValueOnce({ Methods: ['passkey', 'totp'], Preferred: 'passkey', EnrolledMethods: [], AllowedMethods: [] });
    await dataProtectionStore.getState().loadStepUpMethods();
    expect(dataProtectionStore.getState().stepUpMethods).toEqual(['totp']);

    mocked.getStepUpMethods.mockRejectedValueOnce(problem(404, 'not_found'));
    await dataProtectionStore.getState().loadStepUpMethods();
    expect(dataProtectionStore.getState().stepUpMethods).toEqual(['totp']);
  });

  it('holds the grant a passkey returns, in memory only', async () => {
    mocked.getStepUpPasskeyOptions.mockResolvedValue({ RequestId: 'req-1', Options: { challenge: 'abc' } });
    (getPasskeyAssertion as jest.Mock).mockResolvedValue({ id: 'cred' });
    mocked.verifyStepUpPasskey.mockResolvedValue(grant());

    expect(await dataProtectionStore.getState().verifyPasskey()).toBe(true);
    expect(mocked.verifyStepUpPasskey).toHaveBeenCalledWith('req-1', { id: 'cred' });
    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({ 'X-Resgrid-Protected-Grant': 'token-1' });
  });

  it('reports a closed passkey prompt, and never treats a token-less answer as a grant', async () => {
    mocked.getStepUpPasskeyOptions.mockResolvedValue({ RequestId: 'req-1', Options: {} });
    (getPasskeyAssertion as jest.Mock).mockRejectedValueOnce(new PasskeyCeremonyError('cancelled'));
    expect(await dataProtectionStore.getState().verifyPasskey()).toBe(false);
    expect(dataProtectionStore.getState().lastError).toBe('passkey_cancelled');

    (getPasskeyAssertion as jest.Mock).mockResolvedValueOnce({ id: 'cred' });
    mocked.verifyStepUpPasskey.mockResolvedValueOnce({ GrantToken: null } as never);
    expect(await dataProtectionStore.getState().verifyPasskey()).toBe(false);
    expect(dataProtectionStore.getState().isStepUpActive()).toBe(false);
  });

  it('asks Responder, then redeems the approved request for a grant', async () => {
    mocked.requestStepUpApproval.mockResolvedValue({ ApprovalRequestId: 'ap-1', MatchNumber: '07', ExpiresIn: 120 });
    mocked.completeStepUpApproval.mockResolvedValue(grant());
    expect(await dataProtectionStore.getState().requestApproval()).toEqual({ id: 'ap-1', number: '07' });
    expect(await dataProtectionStore.getState().completeApproval('ap-1')).toBe(true);
    expect(mocked.completeStepUpApproval).toHaveBeenCalledWith('ap-1');

    mocked.requestStepUpApproval.mockRejectedValueOnce(problem(400, 'approval_unavailable'));
    expect(await dataProtectionStore.getState().requestApproval()).toBeNull();
    expect(dataProtectionStore.getState().lastError).toBe('approval_unavailable');
  });

  it('runs the provider step-up for protected data and redeems it once', async () => {
    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code-1', codeVerifier: 'v' } });
    mocked.completeStepUpFederated.mockResolvedValue(grant());
    expect(await dataProtectionStore.getState().verifyFederated()).toBe(true);
    expect(mocked.completeStepUpFederated).toHaveBeenCalledWith('sso-1', 'code-1', 'v');

    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    expect(await dataProtectionStore.getState().verifyFederated()).toBe(false);
    expect(dataProtectionStore.getState().lastError).toBe('sso_cancelled');

    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code-1', codeVerifier: 'v' } });
    mocked.completeStepUpFederated.mockRejectedValueOnce(problem(401, 'federated_mfa_not_satisfied'));
    expect(await dataProtectionStore.getState().verifyFederated()).toBe(false);
    expect(dataProtectionStore.getState().lastError).toBe('federated_mfa_not_satisfied');
  });

  it('drops the grant the moment a shared session locks (plan section 10.5)', () => {
    resetSharedSession();
    dataProtectionStore.setState({ grantToken: 'token-1', stepUpExpiresAt: Date.now() + 60000, isPromptOpen: true });

    markSharedSessionLocked(3);

    expect(dataProtectionStore.getState()).toMatchObject({ grantToken: null, stepUpExpiresAt: null, isPromptOpen: false });
    expect(dataProtectionStore.getState().getGrantHeaders()).toEqual({});
    resetSharedSession();
  });
  it('keeps no grant from a ceremony that finished after the shared session locked', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocked.getStepUpPasskeyOptions.mockResolvedValue({ RequestId: 'req-1', Options: {} });
    (getPasskeyAssertion as jest.Mock).mockResolvedValue({ id: 'cred' });
    mocked.verifyStepUpPasskey.mockImplementation(() => new Promise((resolve) => (finish = resolve)) as never);

    const pending = dataProtectionStore.getState().verifyPasskey();
    await new Promise((resolve) => setImmediate(resolve));
    markSharedSessionLocked(5);
    finish(grant());

    await expect(pending).resolves.toBe(false);
    expect(dataProtectionStore.getState().grantToken).toBeNull();
    resetSharedSession();
  });
});
