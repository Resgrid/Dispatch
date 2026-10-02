/* eslint-disable no-undef */
const http = require('http');
const crypto = require('crypto');

const RETURN_PATH = '/sso-return';
const WAIT_MS = 10 * 60 * 1000;
const PAGE =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resgrid</title></head>' +
  '<body style="font-family: sans-serif; padding: 2em"><p>Sign-in finished. You can close this window and return to Resgrid.</p></body></html>';

/**
 * Brokered SSO in the desktop app (passkey workbook section 7.3). The packaged app's page cannot receive a browser
 * redirect, so the broker returns to a one-time listener on 127.0.0.1 (RFC 8252 section 7.3) instead of a custom scheme,
 * which also keeps Unit, IC and Dispatch on one laptop from colliding. Each round trip gets its own listener on a random
 * port. It answers exactly one GET on /sso-return with a page the member can close, hands that address (the one-time
 * code and state) back to the page that asked, and closes; a cancel or ten minutes close it too. PKCE and the state bind
 * the code to this app's round trip, so nothing else is trusted here.
 */
function createSsoLoopback({ openExternal, focus, waitMs = WAIT_MS }) {
  const trips = new Map();

  const close = (id, url) => {
    const trip = trips.get(id);
    if (!trip) {
      return;
    }
    trips.delete(id);
    clearTimeout(trip.timer);
    trip.server.close();
    // No kept-alive connection outlives the one return.
    if (typeof trip.server.closeIdleConnections === 'function') {
      trip.server.closeIdleConnections();
    }
    trip.settle(url);
  };

  const listen = () =>
    new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (request.method !== 'GET' || url.pathname !== RETURN_PATH || !trips.has(id)) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'close' });
        response.end(PAGE);
        if (focus) {
          focus();
        }
        close(id, `http://127.0.0.1:${server.address().port}${request.url}`);
      });
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        let settle;
        const done = new Promise((r) => {
          settle = r;
        });
        trips.set(id, { server, settle, done, timer: setTimeout(() => close(id, null), waitMs) });
        resolve({ id, returnTarget: `http://127.0.0.1:${server.address().port}${RETURN_PATH}` });
      });
    });

  // Opens the provider in the system browser and waits for this listener's one return; null when cancelled or timed out.
  const open = async (id, authorizeUrl) => {
    const trip = trips.get(id);
    if (!trip) {
      return null;
    }
    let parsed;
    try {
      parsed = new URL(authorizeUrl);
    } catch {
      close(id, null);
      return null;
    }
    if (parsed.protocol !== 'https:') {
      close(id, null);
      return null;
    }
    await openExternal(parsed.toString());
    return trip.done;
  };

  const cancel = (id) => close(id, null);

  return {
    listen,
    open,
    cancel,
    get openTrips() {
      return trips.size;
    },
  };
}

function registerSsoLoopback(ipcMain, options) {
  const loopback = createSsoLoopback(options);
  ipcMain.handle('sso:listen', () => loopback.listen());
  ipcMain.handle('sso:open', (_event, id, authorizeUrl) => loopback.open(id, authorizeUrl));
  ipcMain.handle('sso:cancel', (_event, id) => loopback.cancel(id));
  return loopback;
}

module.exports = { createSsoLoopback, registerSsoLoopback, RETURN_PATH };
