import { isSharedSessionLockedRefresh, sharedSession401 } from '../shared-session-errors';

const withBody = (status: number, data: unknown) => ({ response: { status, data } });

describe('shared session refusals', () => {
  it('reads a refresh refused while the shared session is locked, and nothing else', () => {
    expect(isSharedSessionLockedRefresh(withBody(400, { error: 'invalid_grant', shared_session_locked: true }))).toBe(true);
    expect(isSharedSessionLockedRefresh(withBody(400, { error: 'invalid_grant' }))).toBe(false);
    expect(isSharedSessionLockedRefresh(withBody(400, { shared_session_locked: 'true' }))).toBe(false);
    expect(isSharedSessionLockedRefresh(withBody(401, { shared_session_locked: true }))).toBe(false);
    expect(isSharedSessionLockedRefresh(new Error('offline'))).toBe(false);
    expect(isSharedSessionLockedRefresh(null)).toBe(false);
  });

  it('tells a locked session (with its lock version) from an expired shift, and ignores other 401s', () => {
    expect(sharedSession401(withBody(401, { error: 'shared_session_locked', lock_version: 7 }))).toEqual({ kind: 'locked', lockVersion: 7 });
    expect(sharedSession401(withBody(401, { error: 'shared_session_locked' }))).toEqual({ kind: 'locked', lockVersion: null });
    expect(sharedSession401(withBody(401, { error: 'shared_session_expired' }))).toEqual({ kind: 'expired' });
    expect(sharedSession401(withBody(401, ''))).toBeNull();
    expect(sharedSession401(withBody(401, { type: 'invalid_totp' }))).toBeNull();
    expect(sharedSession401(withBody(403, { error: 'shared_session_locked', lock_version: 7 }))).toBeNull();
    expect(sharedSession401(undefined)).toBeNull();
  });
});
