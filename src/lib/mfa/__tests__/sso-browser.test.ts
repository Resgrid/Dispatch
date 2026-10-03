import { createHash } from 'crypto';
import * as WebBrowser from 'expo-web-browser';

import { parseSsoReturn, runSsoRoundTrip, ssoPlatform, ssoReturnTarget } from '../sso-browser';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(), maybeCompleteAuthSession: jest.fn() }));

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const begun = { AuthorizeUrl: 'https://idp.example/authorize', SsoTransactionId: 'sso-1', ExpiresIn: 600 };
const base64Url = (buffer: Buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('parseSsoReturn', () => {
  it('reads the one-time code, the state and an error from the return address', () => {
    expect(parseSsoReturn('resgriddispatch://sso-return?sso_code=abc&state=s1')).toEqual({ ssoCode: 'abc', state: 's1', error: undefined });
    expect(parseSsoReturn('resgriddispatch://sso-return?error=access_denied&state=s1#x')).toEqual({ ssoCode: undefined, state: 's1', error: 'access_denied' });
    expect(parseSsoReturn('resgriddispatch://sso-return')).toEqual({ ssoCode: undefined, state: undefined, error: undefined });
  });
});

describe('runSsoRoundTrip', () => {
  beforeEach(() => openAuthSession.mockReset());

  it('sends only the S256 challenge, returns to the registered target, and keeps the verifier for redemption', async () => {
    let sent: { state: string; codeChallenge: string; returnTarget: string } | null = null;
    openAuthSession.mockImplementation(async () => ({ type: 'success', url: `resgriddispatch://sso-return?sso_code=code-1&state=${sent!.state}` }));

    const result = await runSsoRoundTrip(async (secrets) => {
      sent = secrets;
      return begun;
    });

    expect(sent!.returnTarget).toBe(ssoReturnTarget());
    expect(ssoReturnTarget()).toBe('resgriddispatch://sso-return');
    expect(openAuthSession).toHaveBeenCalledWith(begun.AuthorizeUrl, 'resgriddispatch://sso-return', { preferEphemeralSession: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trip.ssoTransactionId).toBe('sso-1');
      expect(result.trip.ssoCode).toBe('code-1');
      expect(result.trip.codeVerifier).toHaveLength(43);
      expect(base64Url(createHash('sha256').update(result.trip.codeVerifier).digest())).toBe(sent!.codeChallenge);
      expect(result.trip.codeVerifier).not.toBe(sent!.codeChallenge);
    }
  });

  it('refuses a return that is not this round trip, and reports the provider refusing or the member closing it', async () => {
    openAuthSession.mockResolvedValueOnce({ type: 'success', url: 'resgriddispatch://sso-return?sso_code=code-1&state=someone-else' });
    expect(await runSsoRoundTrip(async () => begun)).toEqual({ ok: false, reason: 'state_mismatch' });

    let state = '';
    openAuthSession.mockImplementationOnce(async () => ({ type: 'success', url: `resgriddispatch://sso-return?error=access_denied&state=${state}` }));
    expect(
      await runSsoRoundTrip(async (secrets) => {
        state = secrets.state;
        return begun;
      })
    ).toEqual({ ok: false, reason: 'denied', code: 'access_denied' });

    openAuthSession.mockResolvedValueOnce({ type: 'cancel' });
    expect(await runSsoRoundTrip(async () => begun)).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('opens nothing when the broker refuses to begin, and uses an ephemeral session when asked', async () => {
    expect(await runSsoRoundTrip(async () => Promise.reject({ response: { status: 400, data: { type: 'sso_unavailable' } } }))).toEqual({
      ok: false,
      reason: 'refused',
      code: 'sso_unavailable',
    });
    expect(openAuthSession).not.toHaveBeenCalled();

    openAuthSession.mockResolvedValueOnce({ type: 'dismiss' });
    await runSsoRoundTrip(async () => begun, true);
    expect(openAuthSession).toHaveBeenCalledWith(begun.AuthorizeUrl, 'resgriddispatch://sso-return', { preferEphemeralSession: true });
  });

  it('reports a browser that cannot open as a failed round trip instead of rejecting', async () => {
    openAuthSession.mockRejectedValueOnce(new Error('Another auth session is already open'));

    await expect(runSsoRoundTrip(async () => begun)).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});

describe('runSsoRoundTrip in the desktop app', () => {
  const bridge = {
    ssoListen: jest.fn(async () => ({ id: 'trip-1', returnTarget: 'http://127.0.0.1:50123/sso-return' })),
    ssoOpen: jest.fn(),
    ssoCancel: jest.fn(async () => undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    openAuthSession.mockReset();
    (window as unknown as { electronAPI?: unknown }).electronAPI = { ...bridge, getPlatform: jest.fn() };
  });

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('returns to a one-time loopback listener and opens the provider in the system browser', async () => {
    let sent: { state: string; returnTarget: string; platform: string } | null = null;
    bridge.ssoOpen.mockImplementation(async () => `http://127.0.0.1:50123/sso-return?sso_code=code-9&state=${sent!.state}`);

    const result = await runSsoRoundTrip(async (secrets) => {
      sent = secrets;
      return begun;
    });

    expect(ssoPlatform()).toBe('electron');
    expect(sent!.returnTarget).toBe('http://127.0.0.1:50123/sso-return');
    expect(sent!.platform).toBe('electron');
    expect(bridge.ssoOpen).toHaveBeenCalledWith('trip-1', begun.AuthorizeUrl);
    expect(openAuthSession).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, trip: { ssoCode: 'code-9', ssoTransactionId: 'sso-1' } });
  });

  it('closes the listener when the broker refuses to begin', async () => {
    const refusal = Object.assign(new Error('refused'), { response: { status: 400, data: { type: 'sso_unavailable' } } });

    const result = await runSsoRoundTrip(async () => {
      throw refusal;
    });

    expect(result).toEqual({ ok: false, reason: 'refused', code: 'sso_unavailable' });
    expect(bridge.ssoCancel).toHaveBeenCalledWith('trip-1');
    expect(bridge.ssoOpen).not.toHaveBeenCalled();
  });

  it('reports a listener that cannot start as failed, and opens nothing', async () => {
    bridge.ssoListen.mockRejectedValueOnce(new Error('IPC failed'));
    const begin = jest.fn(async () => begun);

    expect(await runSsoRoundTrip(begin)).toEqual({ ok: false, reason: 'failed' });
    expect(begin).not.toHaveBeenCalled();
    expect(bridge.ssoOpen).not.toHaveBeenCalled();
  });

  it('closes the listener and reports failed when the system browser cannot be opened', async () => {
    bridge.ssoOpen.mockRejectedValueOnce(new Error('no handler'));

    expect(await runSsoRoundTrip(async () => begun)).toEqual({ ok: false, reason: 'failed' });
    expect(bridge.ssoCancel).toHaveBeenCalledWith('trip-1');
  });

  it('reads a closed or timed-out listener as cancelled, and still checks the state', async () => {
    bridge.ssoOpen.mockResolvedValueOnce(null);
    expect(await runSsoRoundTrip(async () => begun)).toEqual({ ok: false, reason: 'cancelled' });

    bridge.ssoOpen.mockResolvedValueOnce('http://127.0.0.1:50123/sso-return?sso_code=x&state=forged');
    expect(await runSsoRoundTrip(async () => begun)).toEqual({ ok: false, reason: 'state_mismatch' });
  });

  it('ignores a partial bridge and uses the auth session', async () => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = { getPlatform: jest.fn(), ssoListen: bridge.ssoListen };
    openAuthSession.mockResolvedValueOnce({ type: 'cancel' });

    expect(ssoPlatform()).not.toBe('electron');
    await runSsoRoundTrip(async () => begun);

    expect(openAuthSession).toHaveBeenCalled();
    expect(bridge.ssoListen).not.toHaveBeenCalled();
  });
});
