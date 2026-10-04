/**
 * Desktop push (electron/push-receiver.js): the main process registers with FCM, keeps its credentials across restarts,
 * hands a push to a window the person is looking at and raises a native notification otherwise, routes that
 * notification's click back to the page, and forgets its credentials on sign-out so the old token dies with them.
 *
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerPushReceiver, toPayload } = require('../push-receiver');

const firebase = { apiKey: 'api-key', projectId: 'resgrid-web', messagingSenderId: '343968022249', appId: '1:343968022249:web:abc', vapidKey: 'BVapid' };

type Handler = (event: unknown, ...args: unknown[]) => unknown;

class FakeIpcMain {
  handlers = new Map<string, Handler>();

  handle(channel: string, handler: Handler) {
    this.handlers.set(channel, handler);
  }

  invoke(channel: string, ...args: unknown[]) {
    return Promise.resolve(this.handlers.get(channel)!({}, ...args));
  }
}

class FakeReceiver {
  static created: FakeReceiver[] = [];
  credentials: { fcm: { token: string } } | undefined;
  notificationListener: ((envelope: unknown) => void) | null = null;
  credentialsListener: ((change: { newCredentials: unknown }) => void) | null = null;
  destroyed = false;
  connected = false;

  constructor(public config: { credentials?: { fcm: { token: string } }; persistentIds: string[]; vapidKey: string; firebase: unknown }) {
    this.credentials = config.credentials;
    FakeReceiver.created.push(this);
  }

  get fcmToken() {
    return this.credentials?.fcm.token;
  }

  onCredentialsChanged(listener: (change: { newCredentials: unknown }) => void) {
    this.credentialsListener = listener;
    return () => undefined;
  }

  onNotification(listener: (envelope: unknown) => void) {
    this.notificationListener = listener;
    return () => undefined;
  }

  async registerIfNeeded() {
    if (!this.credentials) {
      this.credentials = { fcm: { token: `token-${FakeReceiver.created.length}` } };
      this.credentialsListener?.({ newCredentials: this.credentials });
    }
    return this.credentials;
  }

  async connect() {
    this.connected = true;
  }

  destroy() {
    this.destroyed = true;
  }
}

function setup(overrides: Record<string, unknown> = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-push-'));
  const storePath = path.join(directory, 'push-receiver.json');
  const ipcMain = new FakeIpcMain();
  const notify = jest.fn((_payload: unknown, _onClick: () => void) => true);
  const send = jest.fn((_channel: string, _payload: unknown) => true);
  const focus = jest.fn();
  let focused = false;

  const receiver = registerPushReceiver(ipcMain, {
    storePath,
    appName: 'Resgrid Dispatch',
    platform: 'darwin',
    createReceiver: (config: ConstructorParameters<typeof FakeReceiver>[0]) => new FakeReceiver(config),
    notify,
    send,
    focus,
    isWindowFocused: () => focused,
    log: { warn: jest.fn() },
    ...overrides,
  });

  return { ipcMain, storePath, notify, send, focus, receiver, setFocused: (value: boolean) => (focused = value) };
}

const fcmMessage = (eventCode: string, category = 'calls') => ({
  message: {
    notification: { title: 'Structure Fire', body: '123 Main St' },
    data: { title: 'Structure Fire', message: '123 Main St', eventCode, type: '3', category },
  },
  persistentId: `0:${eventCode}`,
});

beforeEach(() => {
  FakeReceiver.created = [];
});

describe('push:start', () => {
  it('registers with FCM, hands back the token and keeps the credentials for the next launch', async () => {
    const { ipcMain, storePath } = setup();

    await expect(ipcMain.invoke('push:start', firebase)).resolves.toEqual({ token: 'token-1' });

    const created = FakeReceiver.created[0];
    expect(created.config.vapidKey).toBe('BVapid');
    expect(created.config.firebase).toEqual({ apiKey: 'api-key', appId: firebase.appId, projectId: 'resgrid-web', messagingSenderId: '343968022249' });
    expect(created.connected).toBe(true);

    const saved = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    expect(saved.credentials).toEqual({ fcm: { token: 'token-1' } });
    // Windows has no POSIX permission bits to check.
    if (process.platform !== 'win32') {
      expect(fs.statSync(storePath).mode & 0o777).toBe(0o600);
    }

    // A restart reuses the saved credentials, so the token the server holds stays valid.
    const restarted = setup({ storePath });
    await expect(restarted.ipcMain.invoke('push:start', firebase)).resolves.toEqual({ token: 'token-1' });
  });

  it('answers repeat calls with the running receiver', async () => {
    const { ipcMain } = setup();

    await ipcMain.invoke('push:start', firebase);
    await ipcMain.invoke('push:start', firebase);

    expect(FakeReceiver.created).toHaveLength(1);
  });

  it('starts over with new credentials for a different Firebase app', async () => {
    const { ipcMain } = setup();

    await ipcMain.invoke('push:start', firebase);
    await expect(ipcMain.invoke('push:start', { ...firebase, appId: 'other-app' })).resolves.toEqual({ token: 'token-2' });

    expect(FakeReceiver.created[0].destroyed).toBe(true);
    expect(FakeReceiver.created[1].config.credentials).toBeUndefined();
  });

  it('refuses an incomplete Firebase config without creating a receiver', async () => {
    const { ipcMain } = setup();

    await expect(ipcMain.invoke('push:start', { ...firebase, vapidKey: '' })).resolves.toEqual({ error: 'invalid-config' });
    expect(FakeReceiver.created).toHaveLength(0);
  });

  it('reports a registration that FCM refused', async () => {
    const failing = setup({
      createReceiver: (config: ConstructorParameters<typeof FakeReceiver>[0]) => {
        const receiver = new FakeReceiver(config);
        receiver.registerIfNeeded = async () => {
          throw new Error('PHONE_REGISTRATION_ERROR');
        };
        return receiver;
      },
    });

    await expect(failing.ipcMain.invoke('push:start', firebase)).resolves.toEqual({ error: 'PHONE_REGISTRATION_ERROR' });
  });

  it('never connects or saves credentials for a start that sign-out stopped mid-registration', async () => {
    let finishRegistering!: () => void;
    const { ipcMain, storePath } = setup({
      createReceiver: (config: ConstructorParameters<typeof FakeReceiver>[0]) => {
        const receiver = new FakeReceiver(config);
        const register = receiver.registerIfNeeded.bind(receiver);
        receiver.registerIfNeeded = () => new Promise((resolve) => (finishRegistering = () => resolve(register())));
        return receiver;
      },
    });

    const started = ipcMain.invoke('push:start', firebase);
    await Promise.resolve();
    await ipcMain.invoke('push:stop', true);
    finishRegistering();

    await expect(started).resolves.toEqual({ error: 'no-token' });
    expect(FakeReceiver.created[0].destroyed).toBe(true);
    expect(FakeReceiver.created[0].connected).toBe(false);
    expect(fs.existsSync(storePath)).toBe(false);
  });

  it('lets a start after a stop run even when the stopped one finishes later', async () => {
    const finishers: (() => void)[] = [];
    const { ipcMain } = setup({
      createReceiver: (config: ConstructorParameters<typeof FakeReceiver>[0]) => {
        const receiver = new FakeReceiver(config);
        const register = receiver.registerIfNeeded.bind(receiver);
        receiver.registerIfNeeded = () => new Promise((resolve) => finishers.push(() => resolve(register())));
        return receiver;
      },
    });

    const first = ipcMain.invoke('push:start', firebase);
    await Promise.resolve();
    await ipcMain.invoke('push:stop', true);
    const second = ipcMain.invoke('push:start', firebase);
    await Promise.resolve();

    finishers[0]();
    await expect(first).resolves.toEqual({ error: 'no-token' });

    // The stopped start finishing must not free the slot the running one holds.
    void ipcMain.invoke('push:start', firebase);
    expect(FakeReceiver.created).toHaveLength(2);

    finishers[1]();
    await expect(second).resolves.toEqual({ token: 'token-2' });
    expect(FakeReceiver.created[1].connected).toBe(true);
  });
});

describe('incoming pushes', () => {
  it('gives a push to the window the person is looking at, not the OS', async () => {
    const { ipcMain, notify, send, setFocused } = setup();
    await ipcMain.invoke('push:start', firebase);
    setFocused(true);

    FakeReceiver.created[0].notificationListener!(fcmMessage('C1234'));

    expect(send).toHaveBeenCalledWith('push:received', { title: 'Structure Fire', body: '123 Main St', eventCode: 'C1234', type: '3', category: 'calls' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('raises a native notification otherwise, and its click brings the window forward with the push', async () => {
    const { ipcMain, notify, send, focus } = setup();
    await ipcMain.invoke('push:start', firebase);

    FakeReceiver.created[0].notificationListener!(fcmMessage('C1234'));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();

    notify.mock.calls[0][1]();
    expect(focus).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('push:notification-click', expect.objectContaining({ eventCode: 'C1234' }));
  });

  it('gives a push to the page when the system has no native notifications', async () => {
    const { ipcMain, notify, send } = setup();
    notify.mockReturnValue(false);
    await ipcMain.invoke('push:start', firebase);

    FakeReceiver.created[0].notificationListener!(fcmMessage('C1234'));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('push:received', expect.objectContaining({ eventCode: 'C1234' }));
  });

  it('keeps a click for a page that is not ready, until it asks', async () => {
    const { ipcMain, notify, send } = setup();
    send.mockReturnValue(false);
    await ipcMain.invoke('push:start', firebase);

    FakeReceiver.created[0].notificationListener!(fcmMessage('M:77', 'messages'));
    notify.mock.calls[0][1]();

    await expect(ipcMain.invoke('push:take-pending-click')).resolves.toEqual(expect.objectContaining({ eventCode: 'M:77' }));
    await expect(ipcMain.invoke('push:take-pending-click')).resolves.toBeNull();
  });

  it('remembers delivered pushes so a restart does not show them again', async () => {
    const { ipcMain, storePath } = setup();
    await ipcMain.invoke('push:start', firebase);

    FakeReceiver.created[0].notificationListener!(fcmMessage('C1'));
    FakeReceiver.created[0].notificationListener!(fcmMessage('C2'));

    expect(JSON.parse(fs.readFileSync(storePath, 'utf8')).persistentIds).toEqual(['0:C1', '0:C2']);

    const restarted = setup({ storePath });
    await restarted.ipcMain.invoke('push:start', firebase);
    expect(FakeReceiver.created[1].config.persistentIds).toEqual(['0:C1', '0:C2']);
  });
});

describe('push:stop', () => {
  it('forgets the credentials on sign-out, so the next start mints a new token', async () => {
    const { ipcMain, storePath } = setup();
    await ipcMain.invoke('push:start', firebase);

    await ipcMain.invoke('push:stop', true);

    expect(FakeReceiver.created[0].destroyed).toBe(true);
    expect(fs.existsSync(storePath)).toBe(false);
    await expect(ipcMain.invoke('push:start', firebase)).resolves.toEqual({ token: 'token-2' });
  });

  it('keeps the credentials when only stopping', async () => {
    const { ipcMain, storePath, receiver } = setup();
    await ipcMain.invoke('push:start', firebase);

    receiver.stop();

    expect(fs.existsSync(storePath)).toBe(true);
  });
});

describe('toPayload', () => {
  it('prefers the data Core sends, falls back to the notification block, then the app name', () => {
    expect(toPayload({ notification: { title: 'N title', body: 'N body' } }, 'Resgrid Dispatch')).toEqual({ title: 'N title', body: 'N body', eventCode: '', type: '', category: '' });
    expect(toPayload(undefined, 'Resgrid Dispatch')).toEqual({ title: 'Resgrid Dispatch', body: '', eventCode: '', type: '', category: '' });
    expect(toPayload({ data: { title: 7, eventCode: ['x'] } }, 'Resgrid Dispatch').title).toBe('Resgrid Dispatch');
  });
});
