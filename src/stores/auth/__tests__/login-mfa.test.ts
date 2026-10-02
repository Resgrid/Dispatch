import { completionGrantRequest } from '@/lib/auth/api';
import { getPasskeyAssertion } from '@/lib/mfa/passkey';
import { PasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { runSsoRoundTrip } from '@/lib/mfa/sso-browser';
import * as api from '@/lib/mfa/transaction-api';

import {
  abandonFactorRecovery,
  finishFactorRecovery,
  forgetLoginSecrets,
  hasLoginTransaction,
  holdLoginTransaction,
  type LoginMfaHost,
  recoveryReplacementKey,
  signInWithBrokeredSso,
  startFactorRecovery,
  startLoginApproval,
  verifyLoginMfa,
  waitForLoginApproval,
} from '../login-mfa';

jest.mock('@/lib/auth/api', () => ({ completionGrantRequest: jest.fn() }));
jest.mock('@/lib/mfa/transaction-api');
jest.mock('@/lib/mfa/passkey', () => ({ getPasskeyAssertion: jest.fn() }));
jest.mock('@/lib/mfa/sso-browser', () => ({ runSsoRoundTrip: jest.fn() }));
// As the real wait does: a decided status ends it, and a failed status call reads as unavailable.
jest.mock('@/lib/mfa/approval-wait', () => ({
  waitForApproval: jest.fn((status: () => Promise<unknown>) =>
    status().then(
      () => 'approved',
      () => 'unavailable'
    )
  ),
}));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const mocked = api as jest.Mocked<typeof api>;
const grant = completionGrantRequest as jest.Mock;
const tokens = { access_token: 'a', refresh_token: 'r', id_token: 'i', expires_in: 60, token_type: 'Bearer', expiration_date: '' };
const completion = (extra: Record<string, unknown> = {}) => ({ CompletionCode: 'code-1', ExpiresIn: 60, Recovery: false, RecoveryCodes: null, ...extra });
const refusal = (status: number, type: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(type), { response: { status, data: { type, ...extra } } });

const host = (): jest.Mocked<LoginMfaHost> => ({ signIn: jest.fn(), setChallenge: jest.fn(), restart: jest.fn() });

describe('finishing a sign-in on the login transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    forgetLoginSecrets();
    grant.mockResolvedValue(tokens);
  });

  it('refuses without a transaction and sends the member back to the start', async () => {
    const h = host();
    expect(await verifyLoginMfa(h, { method: 'totp', code: '123456' })).toEqual({ ok: false, code: 'mfa_transaction_invalid', restart: true });
    expect(h.restart).toHaveBeenCalledWith('mfa_transaction_invalid');
    expect(mocked.completeTotp).not.toHaveBeenCalled();
  });

  it('signs in with a code, spends the completion once, and forgets the transaction', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.completeTotp.mockResolvedValue(completion());

    expect(await verifyLoginMfa(h, { method: 'totp', code: ' 123456 ' })).toEqual({ ok: true, recovery: false });
    expect(mocked.completeTotp).toHaveBeenCalledWith('secret', '123456');
    expect(grant).toHaveBeenCalledWith('secret', 'code-1');
    expect(h.signIn).toHaveBeenCalledWith(tokens, null);
    expect(hasLoginTransaction()).toBe(false);
  });

  it('keeps the sign-in open after a wrong code, and ends it when the server says it is over', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.completeTotp.mockRejectedValueOnce(refusal(401, 'invalid_totp'));
    expect(await verifyLoginMfa(h, { method: 'totp', code: '000000' })).toEqual({ ok: false, code: 'invalid_totp', restart: false });
    expect(hasLoginTransaction()).toBe(true);
    expect(h.restart).not.toHaveBeenCalled();

    mocked.completeTotp.mockRejectedValueOnce(refusal(400, 'mfa_transaction_expired'));
    expect(await verifyLoginMfa(h, { method: 'totp', code: '111111' })).toEqual({ ok: false, code: 'mfa_transaction_expired', restart: true });
    expect(h.restart).toHaveBeenCalledWith('mfa_transaction_expired');
    expect(hasLoginTransaction()).toBe(false);
  });

  it('finishes setting up the required authenticator and hands the new recovery codes over once', async () => {
    const h = host();
    holdLoginTransaction('setup-secret');
    mocked.completeTotpSetup.mockResolvedValue(completion({ RecoveryCodes: ['a', 'b'] }));
    await verifyLoginMfa(h, { method: 'setup', code: '123456' });
    expect(mocked.completeTotpSetup).toHaveBeenCalledWith('setup-secret', '123456');
    expect(h.signIn).toHaveBeenCalledWith(tokens, ['a', 'b']);
  });

  it('signs in with a recovery code as a recovery sign-in', async () => {
    holdLoginTransaction('secret');
    mocked.completeRecoveryCode.mockResolvedValue(completion({ Recovery: true }));
    expect(await verifyLoginMfa(host(), { method: 'recovery_code', code: 'ABCD-EFGH' })).toEqual({ ok: true, recovery: true });
  });

  it('runs a passkey prompt for this sign-in, and a closed prompt is not a failure', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.loginPasskeyOptions.mockResolvedValue({ RequestId: 'req-1', Options: { challenge: 'abc' } });
    (getPasskeyAssertion as jest.Mock).mockResolvedValueOnce({ id: 'cred' });
    mocked.completePasskey.mockResolvedValue(completion());
    expect(await verifyLoginMfa(h, { method: 'passkey' })).toEqual({ ok: true, recovery: false });
    expect(getPasskeyAssertion).toHaveBeenCalledWith({ challenge: 'abc' });
    expect(mocked.completePasskey).toHaveBeenCalledWith('secret', 'req-1', { id: 'cred' });

    holdLoginTransaction('secret');
    (getPasskeyAssertion as jest.Mock).mockRejectedValueOnce(new PasskeyCeremonyError('cancelled'));
    expect(await verifyLoginMfa(h, { method: 'passkey' })).toEqual({ ok: false, code: 'passkey_cancelled', restart: false });
    expect(hasLoginTransaction()).toBe(true);
  });

  it('runs the provider step-up for this sign-in and redeems it with this round trip only', async () => {
    holdLoginTransaction('secret');
    (runSsoRoundTrip as jest.Mock).mockImplementationOnce(async (begin: (s: object) => Promise<unknown>) => {
      await begin({ returnTarget: 'resgriddispatch://sso-return', state: 's', codeChallenge: 'c', platform: 'ios' });
      return { ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code-9', codeVerifier: 'v' } };
    });
    mocked.completeFederated.mockResolvedValue(completion());

    expect(await verifyLoginMfa(host(), { method: 'federated' })).toEqual({ ok: true, recovery: false });
    expect(mocked.ssoBegin).toHaveBeenCalledWith({ Purpose: 'step_up', Transaction: 'secret', ReturnTarget: 'resgriddispatch://sso-return', State: 's', CodeChallenge: 'c', Platform: 'ios' });
    expect(mocked.completeFederated).toHaveBeenCalledWith('secret', 'sso-1', 'code-9', 'v');

    holdLoginTransaction('secret');
    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    expect(await verifyLoginMfa(host(), { method: 'federated' })).toEqual({ ok: false, code: 'sso_cancelled', restart: false });
  });

  it('asks Responder to approve this sign-in and finishes with the approved request', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.requestLoginApproval.mockResolvedValue({ ApprovalRequestId: 'ap-1', MatchNumber: '42', ExpiresIn: 120 });
    mocked.loginApprovalStatus.mockResolvedValue({ State: 'approved', ExpiresAt: null });
    mocked.completeApproval.mockResolvedValue(completion());

    expect(await startLoginApproval(h)).toEqual({ ApprovalRequestId: 'ap-1', MatchNumber: '42', ExpiresIn: 120 });
    expect(await waitForLoginApproval(h, 'ap-1')).toBe('approved');
    expect(mocked.loginApprovalStatus).toHaveBeenCalledWith('secret', 'ap-1');
    expect(await verifyLoginMfa(h, { method: 'passkey_approval', approvalRequestId: 'ap-1' })).toEqual({ ok: true, recovery: false });
    expect(mocked.completeApproval).toHaveBeenCalledWith('secret', 'ap-1');
  });

  it('sends the member back to the start when the sign-in itself ends while Responder is deciding', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.loginApprovalStatus.mockRejectedValue(refusal(400, 'mfa_transaction_expired'));

    expect(await waitForLoginApproval(h, 'ap-1')).toBe('unavailable');
    expect(h.restart).toHaveBeenCalledWith('mfa_transaction_expired');
    expect(hasLoginTransaction()).toBe(false);
  });

  it('keeps the sign-in when a status check fails for another reason', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.loginApprovalStatus.mockRejectedValue(new Error('network'));

    expect(await waitForLoginApproval(h, 'ap-1')).toBe('unavailable');
    expect(h.restart).not.toHaveBeenCalled();
    expect(hasLoginTransaction()).toBe(true);
  });
});

describe('brokered single sign-on', () => {
  const trip = { ok: true, trip: { ssoTransactionId: 'sso-1', ssoCode: 'code-1', codeVerifier: 'verifier' } };

  beforeEach(() => {
    jest.clearAllMocks();
    forgetLoginSecrets();
    grant.mockResolvedValue(tokens);
  });

  it('signs in directly when the provider sign-in needs no second factor', async () => {
    const h = host();
    (runSsoRoundTrip as jest.Mock).mockResolvedValue(trip);
    mocked.ssoRedeem.mockResolvedValue({ Outcome: 'completed', Transaction: 't-1', CompletionCode: 'c-1', ExpiresIn: 60 } as never);

    expect(await signInWithBrokeredSso(h, { departmentToken: 'dept' })).toEqual({ outcome: 'signed_in' });
    expect(mocked.ssoRedeem).toHaveBeenCalledWith('sso-1', 'code-1', 'verifier');
    expect(grant).toHaveBeenCalledWith('t-1', 'c-1');
    expect(h.signIn).toHaveBeenCalledWith(tokens, null);
  });

  it('continues on the transaction the redemption started, with the methods as arrays', async () => {
    const h = host();
    (runSsoRoundTrip as jest.Mock).mockResolvedValue(trip);
    mocked.ssoRedeem.mockResolvedValue({ Outcome: 'mfa_required', Transaction: 't-2', MfaMethods: ['totp', 'passkey'], MfaEnrolled: ['totp'], MfaPreferred: 'totp', ExpiresIn: 300 } as never);

    const result = await signInWithBrokeredSso(h, { username: 'user1' });
    expect(result).toMatchObject({ outcome: 'challenge', challenge: { kind: 'verify', methods: ['totp', 'passkey'], enrolled: ['totp'], preferred: 'totp', source: 'sso' } });
    expect(h.setChallenge).toHaveBeenCalled();
    mocked.completeTotp.mockResolvedValue(completion());
    await verifyLoginMfa(h, { method: 'totp', code: '123456' });
    expect(mocked.completeTotp).toHaveBeenCalledWith('t-2', '123456');
  });

  it('continues as the setup transaction when the department requires MFA the account does not have', async () => {
    const h = host();
    (runSsoRoundTrip as jest.Mock).mockResolvedValue(trip);
    mocked.ssoRedeem.mockRejectedValue(refusal(409, 'mfa_enrollment_required', { mfa_setup_transaction: 'setup-1', mfa_expires_in: 300 }));

    expect(await signInWithBrokeredSso(h, { username: 'user1' })).toMatchObject({ outcome: 'challenge', challenge: { kind: 'setup' } });
    mocked.totpSetupOptions.mockResolvedValue({ SharedKey: 'k', AuthenticatorUri: 'otpauth://', ExpiresIn: 600 });
    mocked.completeTotpSetup.mockResolvedValue(completion({ RecoveryCodes: ['x'] }));
    await verifyLoginMfa(h, { method: 'setup', code: '123456' });
    expect(mocked.completeTotpSetup).toHaveBeenCalledWith('setup-1', '123456');
  });

  it('reports a closed browser as cancelled and a refusal by its code', async () => {
    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    expect(await signInWithBrokeredSso(host(), { username: 'user1' })).toEqual({ outcome: 'cancelled' });
    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'refused', code: 'sso_unavailable' });
    expect(await signInWithBrokeredSso(host(), { username: 'user1' })).toEqual({ outcome: 'failed', code: 'sso_unavailable' });
    (runSsoRoundTrip as jest.Mock).mockResolvedValueOnce(trip);
    mocked.ssoRedeem.mockRejectedValueOnce(refusal(403, 'access_denied'));
    expect(await signInWithBrokeredSso(host(), { username: 'user1' })).toEqual({ outcome: 'failed', code: 'access_denied' });
  });
});

describe('"I lost my authenticator"', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    forgetLoginSecrets();
  });

  it('spends a recovery code on the sign-in, replaces the authenticator, and hands the new codes over once', async () => {
    const h = host();
    holdLoginTransaction('secret');
    mocked.beginFactorRecovery.mockResolvedValue({ Transaction: 'recovery-1', State: 'pending', ExpiresIn: 600, NextActions: [], Passkeys: [] } as never);
    mocked.prepareRecoveryReplacement.mockResolvedValue({ SharedKey: 'k', AuthenticatorUri: 'otpauth://', ExpiresIn: 600 });
    mocked.completeFactorRecovery.mockResolvedValue({ RecoveryCodes: ['n1', 'n2'], SignInAgain: true });

    expect(await startFactorRecovery(h, ' RC-1111 ')).toMatchObject({ passkeys: [] });
    expect(mocked.beginFactorRecovery).toHaveBeenCalledWith('secret', 'RC-1111');
    expect(hasLoginTransaction()).toBe(false);
    expect(h.setChallenge).toHaveBeenCalledWith(null);

    expect(await recoveryReplacementKey()).toMatchObject({ SharedKey: 'k' });
    expect(mocked.prepareRecoveryReplacement).toHaveBeenCalledWith('recovery-1');
    expect(await finishFactorRecovery('123456', ['pk-lost'])).toEqual({ recoveryCodes: ['n1', 'n2'] });
    expect(mocked.completeFactorRecovery).toHaveBeenCalledWith('recovery-1', '123456', ['pk-lost']);
    expect(await finishFactorRecovery('123456', [])).toEqual({ code: 'recovery_transaction_invalid', ended: true });
  });

  it('keeps the recovery open after a wrong code, and cancels it on request', async () => {
    holdLoginTransaction('secret');
    mocked.beginFactorRecovery.mockResolvedValue({ Transaction: 'recovery-1', State: 'pending', ExpiresIn: 600, NextActions: [], Passkeys: [] } as never);
    await startFactorRecovery(host(), 'RC-1111');

    mocked.completeFactorRecovery.mockRejectedValueOnce(refusal(401, 'invalid_totp'));
    expect(await finishFactorRecovery('000000', [])).toEqual({ code: 'invalid_totp', ended: false });
    mocked.cancelFactorRecovery.mockResolvedValue({ Transaction: null, State: 'canceled', ExpiresIn: 0, NextActions: null, Passkeys: null } as never);
    await abandonFactorRecovery();
    expect(mocked.cancelFactorRecovery).toHaveBeenCalledWith('recovery-1');
    expect(await recoveryReplacementKey()).toEqual({ code: 'recovery_transaction_invalid' });
  });
});
