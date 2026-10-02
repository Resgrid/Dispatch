const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../common/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }));

import { beginUnlockSso, cancelUnlockApproval, completeUnlock, endShift, getCurrentSession, getUnlockApprovalStatus, getUnlockOptions, lockSession, requestUnlockApproval } from '../shared-session';

const ok = (Data: unknown) => Promise.resolve({ data: { Data } });

describe('shared session API (passkey workbook section 8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation(() => ok({ Locked: false }));
    mockPost.mockImplementation(() => ok({ Locked: true, LockVersion: 3 }));
    mockDelete.mockImplementation(() => ok({ State: 'canceled' }));
  });

  it('reports operator activity only when asked; polling never does', async () => {
    await getCurrentSession();
    expect(mockGet).toHaveBeenLastCalledWith('/sessions/current', {});

    await getCurrentSession(true);
    expect(mockGet).toHaveBeenLastCalledWith('/sessions/current', { headers: { 'X-Resgrid-Operator-Activity': '1' } });
  });

  it('sends a body on every POST, PascalCase, with the lock version the unlock answers', async () => {
    await expect(lockSession()).resolves.toEqual({ Locked: true, LockVersion: 3 });
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/lock', {});

    await endShift(true);
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/end-shift', { SwitchOperator: true });

    await getUnlockOptions(3);
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/unlock-options', { LockVersion: 3 });

    await requestUnlockApproval(3);
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/unlock-approval', { LockVersion: 3 });

    await beginUnlockSso(3, { returnTarget: 'resgriddispatch://sso-return', state: 's', codeChallenge: 'c', platform: 'ios' });
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/unlock-sso', { LockVersion: 3, Platform: 'ios', ReturnTarget: 'resgriddispatch://sso-return', State: 's', CodeChallenge: 'c', CodeChallengeMethod: 'S256' });

    await completeUnlock(3, { Method: 'totp', Code: '123456' });
    expect(mockPost).toHaveBeenLastCalledWith('/sessions/complete-unlock', { LockVersion: 3, Method: 'totp', Code: '123456' });
  });

  it("reads and cancels this session's unlock approval by its id", async () => {
    await getUnlockApprovalStatus('a/b');
    expect(mockGet).toHaveBeenLastCalledWith('/sessions/unlock-approval/a%2Fb');
    await cancelUnlockApproval('a/b');
    expect(mockDelete).toHaveBeenLastCalledWith('/sessions/unlock-approval/a%2Fb');
  });
});
