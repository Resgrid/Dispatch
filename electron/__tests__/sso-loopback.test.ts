/**
 * The desktop loopback for brokered SSO (electron/sso-loopback.js): one listener per round trip on 127.0.0.1, exactly one
 * return on /sso-return, https-only provider pages, and cancel/timeout closing the listener.
 *
 * @jest-environment node
 */
import http from 'http';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createSsoLoopback, registerSsoLoopback, RETURN_PATH } = require('../sso-loopback');

const get = (url: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body, headers: response.headers }));
      })
      .on('error', reject);
  });

describe('createSsoLoopback', () => {
  it('listens on 127.0.0.1 and hands back the one return the provider sends', async () => {
    const openExternal = jest.fn(async () => undefined);
    const focus = jest.fn();
    const loopback = createSsoLoopback({ openExternal, focus });

    const listener = await loopback.listen();
    expect(listener.returnTarget).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/sso-return$/);
    expect(RETURN_PATH).toBe('/sso-return');

    const returned = loopback.open(listener.id, 'https://login.resgrid.com/sso/authorize?x=1');
    await new Promise((resolve) => setImmediate(resolve));
    expect(openExternal).toHaveBeenCalledWith('https://login.resgrid.com/sso/authorize?x=1');

    const page = await get(`${listener.returnTarget}?sso_code=abc&state=xyz`);
    expect(page.status).toBe(200);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body).toContain('Sign-in finished');

    await expect(returned).resolves.toBe(`${listener.returnTarget}?sso_code=abc&state=xyz`);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(loopback.openTrips).toBe(0);

    // One return only: the listener is gone.
    expect(page.headers.connection).toBe('close');
    await expect(get(`${listener.returnTarget}?sso_code=again`)).rejects.toThrow();
  });

  it('answers anything but GET /sso-return with 404 and keeps waiting', async () => {
    const loopback = createSsoLoopback({ openExternal: async () => undefined });
    const listener = await loopback.listen();
    const port = new URL(listener.returnTarget).port;

    const other = await get(`http://127.0.0.1:${port}/favicon.ico`);
    expect(other.status).toBe(404);
    expect(loopback.openTrips).toBe(1);

    loopback.cancel(listener.id);
    expect(loopback.openTrips).toBe(0);
  });

  it('refuses a provider page that is not https, and closes the listener', async () => {
    const openExternal = jest.fn(async () => undefined);
    const loopback = createSsoLoopback({ openExternal });
    const listener = await loopback.listen();

    await expect(loopback.open(listener.id, 'http://evil.example/authorize')).resolves.toBeNull();
    await expect(loopback.open(listener.id, 'not a url')).resolves.toBeNull();
    expect(openExternal).not.toHaveBeenCalled();
    expect(loopback.openTrips).toBe(0);
  });

  it('resolves null on cancel and on timeout', async () => {
    const loopback = createSsoLoopback({ openExternal: async () => undefined, waitMs: 50 });

    const first = await loopback.listen();
    const cancelled = loopback.open(first.id, 'https://login.resgrid.com/a');
    await new Promise((resolve) => setImmediate(resolve));
    loopback.cancel(first.id);
    await expect(cancelled).resolves.toBeNull();

    const second = await loopback.listen();
    await expect(loopback.open(second.id, 'https://login.resgrid.com/b')).resolves.toBeNull();
    expect(loopback.openTrips).toBe(0);

    await expect(loopback.open('unknown', 'https://login.resgrid.com/c')).resolves.toBeNull();
  });

  it('gives every round trip its own listener', async () => {
    const loopback = createSsoLoopback({ openExternal: async () => undefined });
    const a = await loopback.listen();
    const b = await loopback.listen();
    expect(a.id).not.toBe(b.id);
    expect(a.returnTarget).not.toBe(b.returnTarget);
    loopback.cancel(a.id);
    loopback.cancel(b.id);
  });
});

describe('registerSsoLoopback', () => {
  it('exposes listen, open and cancel over IPC', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) };
    registerSsoLoopback(ipcMain, { openExternal: async () => undefined });

    expect([...handlers.keys()].sort()).toEqual(['sso:cancel', 'sso:listen', 'sso:open']);
    const listener = (await handlers.get('sso:listen')!()) as { id: string; returnTarget: string };
    const opened = handlers.get('sso:open')!({}, listener.id, 'https://login.resgrid.com/x') as Promise<string | null>;
    await new Promise((resolve) => setImmediate(resolve));
    handlers.get('sso:cancel')!({}, listener.id);
    await expect(opened).resolves.toBeNull();
  });
});
