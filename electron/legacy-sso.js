/* eslint-disable no-undef */
const crypto = require('crypto');

const CALLBACK_HOST = 'auth';
const CALLBACK_PATH = '/callback';
const WAIT_MS = 10 * 60 * 1000;
const SCOPES = 'openid email profile offline_access';

const failed = { ok: false, reason: 'failed' };
const cancelled = { ok: false, reason: 'cancelled' };

const base64Url = (bytes) => Buffer.from(bytes).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** An https URL, or http on this computer's loopback (a development server); null for anything else. */
const safeUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  return url.protocol === 'https:' || (url.protocol === 'http:' && loopback) ? url : null;
};

/**
 * Legacy (unbrokered) SSO in the desktop app. Without the broker, the department's OIDC provider and the server's SAML
 * relay return the member to this app's own scheme, `<scheme>://auth/callback`: the redirect URI the department already
 * registers for the mobile app. The OS hands that link to this process (open-url on macOS, a second instance's argv on
 * Windows and Linux). The page, served from app://, can receive neither, and a provider refuses to redeem a desktop
 * app's OIDC code cross-origin. So this process runs the OIDC code flow as a native client does: PKCE and state, the
 * provider in the member's own browser, the code redeemed here, and only the id_token handed to the page. For SAML it
 * opens the server's start page and hands the relay's link back to the page, which checks its own RelayState.
 *
 * On a shared installation the page asks for a fresh sign-in (reauthenticate): the provider is told to authenticate the
 * member again (prompt=login, max_age=0), because the member's browser may still hold the last operator's provider
 * session, and the server refuses a sign-in that is not fresh.
 *
 * One sign-in waits at a time; a new one replaces it, and cancel or ten minutes end it. A link that matches nothing
 * waiting (no sign-in, another state, another RelayState) is ignored, so a forged link cannot end the member's sign-in.
 */
function createLegacySso({ scheme, openExternal, fetch, focus, waitMs = WAIT_MS }) {
  const protocol = `${scheme.toLowerCase()}:`;
  // The registered form of the redirect URI: lowercase, as the department enters it with its provider.
  const redirectUri = `${scheme.toLowerCase()}://${CALLBACK_HOST}${CALLBACK_PATH}`;
  let waiting = null;

  const settle = (outcome) => {
    if (!waiting) {
      return;
    }
    const trip = waiting;
    waiting = null;
    clearTimeout(trip.timer);
    trip.resolve(outcome);
  };

  const wait = (accept) => {
    settle(cancelled);
    return new Promise((resolve) => {
      waiting = { accept, resolve, timer: setTimeout(() => settle(cancelled), waitMs) };
    });
  };

  const open = async (url) => {
    try {
      await openExternal(url);
    } catch {
      settle(failed);
    }
  };

  /** This app's sign-in return, or null for any other link. */
  const callbackParams = (link) => {
    let url;
    try {
      url = new URL(link);
    } catch {
      return null;
    }
    return url.protocol === protocol && url.hostname === CALLBACK_HOST && url.pathname === CALLBACK_PATH ? url.searchParams : null;
  };

  /**
   * A link the OS handed this app. True when it is this app's sign-in return (taken, or ignored when nothing waits for
   * it), so the caller does not pass it on; false for any other link.
   */
  const handleLink = (link) => {
    const params = callbackParams(link);
    if (!params) {
      return false;
    }
    if (waiting && waiting.accept(params)) {
      if (focus) {
        focus();
      }
      settle({ ok: true, params, link });
    }
    return true;
  };

  const oidc = async (authority, clientId, reauthenticate = false) => {
    const issuer = safeUrl(authority);
    if (!issuer || typeof clientId !== 'string' || !clientId) {
      return failed;
    }

    let metadata;
    try {
      const response = await fetch(`${issuer.toString().replace(/\/+$/, '')}/.well-known/openid-configuration`, { headers: { Accept: 'application/json' } });
      metadata = response.ok ? await response.json() : null;
    } catch {
      metadata = null;
    }
    const authorizeUrl = safeUrl(metadata?.authorization_endpoint);
    const tokenUrl = safeUrl(metadata?.token_endpoint);
    if (!authorizeUrl || !tokenUrl) {
      return failed;
    }

    const verifier = base64Url(crypto.randomBytes(32));
    const state = base64Url(crypto.randomBytes(24));
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', SCOPES);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', base64Url(crypto.createHash('sha256').update(verifier).digest()));
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    if (reauthenticate) {
      authorizeUrl.searchParams.set('prompt', 'login');
      authorizeUrl.searchParams.set('max_age', '0');
    }

    const returned = wait((params) => params.get('state') === state);
    await open(authorizeUrl.toString());
    const outcome = await returned;
    if (!outcome.ok) {
      return outcome;
    }

    const error = outcome.params.get('error');
    if (error) {
      return { ok: false, reason: error === 'access_denied' ? 'denied' : 'failed', code: error };
    }
    const code = outcome.params.get('code');
    if (!code) {
      return failed;
    }

    try {
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier }).toString(),
      });
      const tokens = response.ok ? await response.json() : null;
      return typeof tokens?.id_token === 'string' && tokens.id_token ? { ok: true, idToken: tokens.id_token } : failed;
    } catch {
      return failed;
    }
  };

  const saml = async (signInUrl) => {
    const page = safeUrl(signInUrl);
    const relayState = page?.searchParams.get('RelayState');
    if (!page || !relayState) {
      return failed;
    }

    const returned = wait((params) => !!params.get('saml_response') && params.get('relay_state') === relayState);
    await open(page.toString());
    const outcome = await returned;
    return outcome.ok ? { ok: true, url: outcome.link } : outcome;
  };

  const cancel = () => settle(cancelled);

  /** The sign-in return among a second instance's arguments, if any. */
  const linkIn = (argv) => (Array.isArray(argv) ? (argv.find((arg) => typeof arg === 'string' && callbackParams(arg)) ?? null) : null);

  return {
    oidc,
    saml,
    cancel,
    handleLink,
    linkIn,
    redirectUri,
    get waiting() {
      return waiting !== null;
    },
  };
}

function registerLegacySso(ipcMain, options) {
  const legacySso = createLegacySso(options);
  ipcMain.handle('legacy-sso:oidc', (_event, authority, clientId, reauthenticate) => legacySso.oidc(authority, clientId, reauthenticate === true));
  ipcMain.handle('legacy-sso:saml', (_event, signInUrl) => legacySso.saml(signInUrl));
  ipcMain.handle('legacy-sso:cancel', () => legacySso.cancel());
  return legacySso;
}

module.exports = { createLegacySso, registerLegacySso };
