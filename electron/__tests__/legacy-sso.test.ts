/**
 * Legacy SSO in the desktop app (electron/legacy-sso.js): the OIDC code flow run as a native client (PKCE and state, the
 * provider in the member's browser, the code redeemed in the main process), the SAML start page, and the return on this
 * app's own scheme, which only a waiting sign-in with the same state or RelayState takes.
 *
 * @jest-environment node
 */
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createLegacySso, registerLegacySso } = require('../legacy-sso');

const AUTHORITY = 'https://login.example-idp.com/tenant';
const DISCOVERY = `${AUTHORITY}/.well-known/openid-configuration`;
const AUTHORIZE = 'https://login.example-idp.com/tenant/oauth2/authorize';
const TOKEN = 'https://login.example-idp.com/tenant/oauth2/token';
const START = 'https://api.resgrid.com/api/v4/connect/saml-mobile-login?departmentToken=enc&RelayState=dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13';

const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const base64Url = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tick = () => new Promise((resolve) => setImmediate(resolve));

interface Fixture {
  sso: ReturnType<typeof createLegacySso>;
  opened: string[];
  requests: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[];
  focus: jest.Mock;
}

const fixture = (overrides: { tokenAnswer?: unknown; discovery?: unknown; waitMs?: number; openExternal?: (url: string) => Promise<void> } = {}): Fixture => {
  const opened: string[] = [];
  const requests: Fixture['requests'] = [];
  const focus = jest.fn();
  const fetch = jest.fn(async (url: string, init?: Fixture['requests'][number]['init']) => {
    requests.push({ url, init });
    if (url === DISCOVERY) {
      return 'discovery' in overrides ? overrides.discovery : json({ issuer: AUTHORITY, authorization_endpoint: AUTHORIZE, token_endpoint: TOKEN });
    }
    if (url === TOKEN) {
      return 'tokenAnswer' in overrides ? overrides.tokenAnswer : json({ id_token: 'idp.id.token', access_token: 'at', token_type: 'Bearer' });
    }
    return json({}, 404);
  });
  const openExternal =
    overrides.openExternal ??
    (async (url: string) => {
      opened.push(url);
    });
  // As main.js passes it: the app's linking scheme, in its mixed case.
  const sso = createLegacySso({ scheme: 'ResgridDispatch', openExternal, fetch, focus, ...(overrides.waitMs ? { waitMs: overrides.waitMs } : {}) });
  return { sso, opened, requests, focus };
};

/** Starts an OIDC sign-in and waits until the provider page is open; returns the pending answer and the page. */
const startOidc = async (f: Fixture) => {
  const answer = f.sso.oidc(AUTHORITY, 'resgrid-desktop');
  for (let i = 0; i < 10 && f.opened.length === 0; i++) {
    await tick();
  }
  return { answer, page: new URL(f.opened[f.opened.length - 1]) };
};

describe('createLegacySso: OIDC', () => {
  it("runs the code flow with PKCE in the member's browser and redeems the code here, on the app's registered redirect URI", async () => {
    const f = fixture();
    const { answer, page } = await startOidc(f);

    expect(`${page.origin}${page.pathname}`).toBe(AUTHORIZE);
    expect(Object.fromEntries(page.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'resgrid-desktop',
      redirect_uri: 'resgriddispatch://auth/callback',
      scope: 'openid email profile offline_access',
      state: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
      code_challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      code_challenge_method: 'S256',
    });
    expect(f.sso.redirectUri).toBe('resgriddispatch://auth/callback');

    expect(f.sso.handleLink(`resgriddispatch://auth/callback?code=the-code&state=${page.searchParams.get('state')}`)).toBe(true);
    await expect(answer).resolves.toEqual({ ok: true, idToken: 'idp.id.token' });
    expect(f.focus).toHaveBeenCalledTimes(1);

    const redemption = f.requests.find((r) => r.url === TOKEN)!;
    expect(redemption.init?.method).toBe('POST');
    expect(redemption.init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' });
    const form = Object.fromEntries(new URLSearchParams(redemption.init?.body));
    expect(form).toEqual({ grant_type: 'authorization_code', code: 'the-code', redirect_uri: 'resgriddispatch://auth/callback', client_id: 'resgrid-desktop', code_verifier: expect.any(String) });
    // The verifier the provider receives is the one the challenge was made from.
    expect(base64Url(crypto.createHash('sha256').update(form.code_verifier).digest())).toBe(page.searchParams.get('code_challenge'));
    expect(f.sso.waiting).toBe(false);
  });

  it('asks the provider to authenticate the member again for a shared installation, and only then', async () => {
    const shared = fixture();
    const answer = shared.sso.oidc(AUTHORITY, 'resgrid-desktop', true);
    for (let i = 0; i < 10 && shared.opened.length === 0; i++) {
      await tick();
    }
    const page = new URL(shared.opened[0]);
    expect(page.searchParams.get('prompt')).toBe('login');
    expect(page.searchParams.get('max_age')).toBe('0');
    shared.sso.cancel();
    await answer;

    const personal = fixture();
    const { answer: personalAnswer, page: personalPage } = await startOidc(personal);
    expect(personalPage.searchParams.has('prompt')).toBe(false);
    expect(personalPage.searchParams.has('max_age')).toBe(false);
    personal.sso.cancel();
    await personalAnswer;
  });

  it('ignores a link with another state, or no state, and keeps waiting for its own', async () => {
    const f = fixture();
    const { answer, page } = await startOidc(f);

    expect(f.sso.handleLink('resgriddispatch://auth/callback?code=forged&state=someone-elses')).toBe(true);
    expect(f.sso.handleLink('resgriddispatch://auth/callback?code=forged')).toBe(true);
    expect(f.sso.waiting).toBe(true);
    expect(f.focus).not.toHaveBeenCalled();

    f.sso.handleLink(`resgriddispatch://auth/callback?code=real&state=${page.searchParams.get('state')}`);
    await expect(answer).resolves.toEqual({ ok: true, idToken: 'idp.id.token' });
    expect(new URLSearchParams(f.requests.find((r) => r.url === TOKEN)!.init?.body).get('code')).toBe('real');
  });

  it("reports the provider's refusal: a denial, or another error with its code", async () => {
    const denied = fixture();
    const first = await startOidc(denied);
    denied.sso.handleLink(`resgriddispatch://auth/callback?error=access_denied&state=${first.page.searchParams.get('state')}`);
    await expect(first.answer).resolves.toEqual({ ok: false, reason: 'denied', code: 'access_denied' });

    const broken = fixture();
    const second = await startOidc(broken);
    broken.sso.handleLink(`resgriddispatch://auth/callback?error=invalid_scope&state=${second.page.searchParams.get('state')}`);
    await expect(second.answer).resolves.toEqual({ ok: false, reason: 'failed', code: 'invalid_scope' });
    expect(broken.requests.some((r) => r.url === TOKEN)).toBe(false);
  });

  it('fails when the return has no code, or the provider redeems it without an id_token or at all', async () => {
    const noCode = fixture();
    const a = await startOidc(noCode);
    noCode.sso.handleLink(`resgriddispatch://auth/callback?state=${a.page.searchParams.get('state')}`);
    await expect(a.answer).resolves.toEqual({ ok: false, reason: 'failed' });

    for (const tokenAnswer of [json({ access_token: 'at' }), json({ error: 'invalid_grant' }, 400), json({ id_token: '' }), json({ id_token: 'idp.id.token' }, 500)]) {
      const f = fixture({ tokenAnswer });
      const { answer, page } = await startOidc(f);
      f.sso.handleLink(`resgriddispatch://auth/callback?code=c&state=${page.searchParams.get('state')}`);
      await expect(answer).resolves.toEqual({ ok: false, reason: 'failed' });
    }
  });

  it('opens nothing for an authority or provider pages that are not https, a missing client id, or a discovery failure', async () => {
    const cases: [string, string, unknown][] = [
      ['http://login.example-idp.com/tenant', 'c', undefined],
      ['javascript:alert(1)', 'c', undefined],
      ['not a url', 'c', undefined],
      [AUTHORITY, '', undefined],
      [AUTHORITY, 'c', json({}, 500)],
      [AUTHORITY, 'c', json({ authorization_endpoint: 'http://login.example-idp.com/authorize', token_endpoint: TOKEN })],
      [AUTHORITY, 'c', json({ authorization_endpoint: AUTHORIZE, token_endpoint: 'http://login.example-idp.com/token' })],
      [AUTHORITY, 'c', json({ authorization_endpoint: AUTHORIZE })],
      // A provider page that answers with an error is no discovery document, whatever its body says.
      [AUTHORITY, 'c', json({ authorization_endpoint: AUTHORIZE, token_endpoint: TOKEN }, 503)],
    ];
    for (const [authority, clientId, discovery] of cases) {
      const f = fixture(discovery === undefined ? {} : { discovery });
      await expect(f.sso.oidc(authority, clientId)).resolves.toEqual({ ok: false, reason: 'failed' });
      expect(f.opened).toEqual([]);
      if (discovery === undefined) {
        // Refused before anything is fetched: no discovery document is read from an address that is not https.
        expect(f.requests).toEqual([]);
      }
      expect(f.sso.waiting).toBe(false);
    }
  });

  it('reads the discovery document under the authority, whatever its trailing slash', async () => {
    const f = fixture();
    const answer = f.sso.oidc(`${AUTHORITY}/`, 'c');
    await tick();
    expect(f.requests[0].url).toBe(DISCOVERY);
    f.sso.cancel();
    await expect(answer).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });
});

describe('createLegacySso: SAML', () => {
  it("opens the server's start page and answers with the relay's link back, for the page to check", async () => {
    const f = fixture();
    const answer = f.sso.saml(START);
    await tick();
    expect(f.opened).toEqual([START]);

    const relayed = 'resgriddispatch://auth/callback?saml_response=saml-relay%3Aabc&department_token=enc&relay_state=dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13';
    expect(f.sso.handleLink(relayed)).toBe(true);
    await expect(answer).resolves.toEqual({ ok: true, url: relayed });
    expect(f.focus).toHaveBeenCalledTimes(1);
  });

  it('ignores a relay link with another RelayState or no SAML response', async () => {
    const f = fixture();
    const answer = f.sso.saml(START);
    await tick();

    f.sso.handleLink('resgriddispatch://auth/callback?saml_response=x&relay_state=dispatch.someone-elses-nonce-0000');
    f.sso.handleLink('resgriddispatch://auth/callback?relay_state=dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13');
    expect(f.sso.waiting).toBe(true);

    f.sso.cancel();
    await expect(answer).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });

  it('opens no start page that is not https (loopback http aside) or that carries no RelayState', async () => {
    for (const page of ['http://api.resgrid.com/api/v4/connect/saml-mobile-login?RelayState=dispatch.x', 'https://api.resgrid.com/api/v4/connect/saml-mobile-login', 'file:///etc/passwd?RelayState=x']) {
      const f = fixture();
      await expect(f.sso.saml(page)).resolves.toEqual({ ok: false, reason: 'failed' });
      expect(f.opened).toEqual([]);
    }

    const dev = fixture();
    const answer = dev.sso.saml('http://127.0.0.1:5098/api/v4/connect/saml-mobile-login?RelayState=dispatch.dev-nonce-0123456789');
    await tick();
    expect(dev.opened).toHaveLength(1);
    dev.sso.cancel();
    await answer;
  });
});

describe('createLegacySso: one sign-in at a time', () => {
  it('a new sign-in replaces the waiting one, and cancel or the time limit ends it', async () => {
    const f = fixture();
    const first = f.sso.saml(START);
    await tick();
    const second = f.sso.saml(START);
    await expect(first).resolves.toEqual({ ok: false, reason: 'cancelled' });

    f.sso.cancel();
    await expect(second).resolves.toEqual({ ok: false, reason: 'cancelled' });
    expect(f.sso.waiting).toBe(false);

    const timed = fixture({ waitMs: 20 });
    await expect(timed.sso.saml(START)).resolves.toEqual({ ok: false, reason: 'cancelled' });
    expect(timed.sso.waiting).toBe(false);
  });

  it('fails when the browser cannot be opened', async () => {
    const f = fixture({
      openExternal: async () => {
        throw new Error('no browser');
      },
    });
    await expect(f.sso.saml(START)).resolves.toEqual({ ok: false, reason: 'failed' });
    expect(f.sso.waiting).toBe(false);
  });

  it("takes only this app's sign-in return: other links are left to the caller, and a return with nothing waiting is dropped", () => {
    const f = fixture();
    expect(f.sso.handleLink('resgriddispatch://auth/callback?code=x&state=y')).toBe(true);
    expect(f.sso.handleLink('resgriddispatch://calls/42')).toBe(false);
    expect(f.sso.handleLink('resgriddispatch://other/callback?code=x&state=y')).toBe(false);
    expect(f.sso.handleLink('resgriddispatch://auth/other?code=x&state=y')).toBe(false);
    expect(f.sso.handleLink('resgridunit://auth/callback?code=x&state=y')).toBe(false);
    expect(f.sso.handleLink('https://resgrid.com/auth/callback?code=x')).toBe(false);
    expect(f.sso.handleLink('not a link')).toBe(false);
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("finds the return among a second instance's arguments, whatever the scheme's case", () => {
    const f = fixture();
    expect(f.sso.linkIn(['C:\\Resgrid Dispatch\\Resgrid Dispatch.exe', '--allow-file-access', 'ResgridDispatch://auth/callback?code=x&state=y'])).toBe('ResgridDispatch://auth/callback?code=x&state=y');
    expect(f.sso.linkIn(['Resgrid Dispatch.exe', 'resgriddispatch://calls/42'])).toBeNull();
    expect(f.sso.linkIn(undefined)).toBeNull();
  });
});

describe('registerLegacySso', () => {
  it('answers the renderer on three channels', async () => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const ipcMain = { handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => (handlers[channel] = handler)) };
    const opened: string[] = [];
    const sso = registerLegacySso(ipcMain, {
      scheme: 'resgriddispatch',
      openExternal: async (url: string) => {
        opened.push(url);
      },
      fetch: async () => json({}, 500),
    });

    expect(Object.keys(handlers).sort()).toEqual(['legacy-sso:cancel', 'legacy-sso:oidc', 'legacy-sso:saml']);
    await expect(handlers['legacy-sso:oidc']({}, AUTHORITY, 'c')).resolves.toEqual({ ok: false, reason: 'failed' });

    // Only a literal true from the page asks for reauthentication.
    const oidc = jest.spyOn(sso, 'oidc');
    await handlers['legacy-sso:oidc']({}, AUTHORITY, 'c', 'yes');
    await handlers['legacy-sso:oidc']({}, AUTHORITY, 'c', true);
    expect(oidc.mock.calls).toEqual([
      [AUTHORITY, 'c', false],
      [AUTHORITY, 'c', true],
    ]);

    const saml = handlers['legacy-sso:saml']({}, START) as Promise<unknown>;
    await tick();
    expect(opened).toEqual([START]);
    expect(sso.waiting).toBe(true);
    handlers['legacy-sso:cancel']({});
    await expect(saml).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });
});
