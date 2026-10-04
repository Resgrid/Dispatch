/**
 * Push on the web and desktop editions (services/web-push.web.ts): a browser mints an FCM web token, a desktop gets
 * one from its main process, and either is registered on the dispatcher's user subscriber as Platform 3. A registration
 * never outlives its session: sign-out unregisters and kills the token, and another person on the device rotates it.
 */

const mockRegisterDevice = jest.fn(async () => ({}));
const mockUnRegisterWebPush = jest.fn(async () => ({}));
const mockRouterPushWithRetry = jest.fn(async () => undefined);
const mockShowNotificationModal = jest.fn(async () => undefined);
const mockFirebaseGetToken = jest.fn(async () => 'browser-token');
const mockFirebaseDeleteToken = jest.fn(async () => true);

jest.mock('firebase/app', () => ({ getApps: () => [], initializeApp: (_config: unknown, name: string) => ({ name }) }));
jest.mock('firebase/messaging', () => ({
  isSupported: async () => true,
  getMessaging: () => 'messaging',
  getToken: (...args: unknown[]) => mockFirebaseGetToken(...(args as [])),
  deleteToken: (...args: unknown[]) => mockFirebaseDeleteToken(...(args as [])),
}));
jest.mock('@/api/devices/push', () => ({
  registerDevice: (...args: unknown[]) => mockRegisterDevice(...(args as [])),
  unRegisterWebPush: (...args: unknown[]) => mockUnRegisterWebPush(...(args as [])),
}));
jest.mock('@/lib/navigation', () => ({ routerPushWithRetry: (...args: unknown[]) => mockRouterPushWithRetry(...(args as [])) }));
jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4', getDeviceUuid: () => 'device-uuid' }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/mfa/client-app', () => ({ CLIENT_HEADER: 'X-Resgrid-Client', RESGRID_CLIENT: 'dispatch' }));
jest.mock('@/stores/push-notification/store', () => {
  const actual = jest.requireActual('@/stores/push-notification/store');
  return { ...actual, usePushNotificationModalStore: { getState: () => ({ showNotificationModal: mockShowNotificationModal }) } };
});
jest.mock('@/services/audio.service', () => ({ audioService: { playNotificationSound: jest.fn(() => Promise.resolve()) } }));

const mockState = {
  auth: { status: 'signedIn', accessToken: 'access-token', userId: 'user-1' } as { status: string; accessToken: string | null; userId: string | null },
  core: { config: null as Record<string, string> | null },
  security: { rights: { DepartmentCode: 'DEPT' } as { DepartmentCode: string } | null },
};

const mockStoreOf = (read: () => object) => Object.assign((selector: (value: object) => unknown) => selector(read()), { getState: read });
jest.mock('@/stores/auth/store', () => ({ __esModule: true, default: mockStoreOf(() => mockState.auth) }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: mockStoreOf(() => mockState.core) }));
jest.mock('@/stores/security/store', () => ({ securityStore: mockStoreOf(() => mockState.security) }));

const firebaseConfig = {
  WebPushApiKey: 'api-key',
  WebPushAuthDomain: '',
  WebPushProjectId: 'resgrid-web',
  WebPushMessagingSenderId: '343968022249',
  WebPushAppId: '1:343968022249:web:abc',
  WebPushVapidKey: 'BVapid',
};

type Module = typeof import('../web-push.web');
type Hooks = typeof import('@/lib/auth/sign-out-hooks');

const globals = globalThis as unknown as Record<string, unknown>;
let storage: Map<string, string>;
let worker: { scriptURL: string; postMessage: jest.Mock };
let serviceWorkerListeners: ((event: { data: unknown }) => void)[];
let permission: NotificationPermission;
let requestPermission: jest.Mock;
let clickListeners: Set<() => void>;

/** A click anywhere on the page, as the person would make one. */
const clickPage = () => [...clickListeners].forEach((listener) => listener());

function installBrowser() {
  storage = new Map();
  worker = { scriptURL: 'https://dispatch.test/service-worker.js', postMessage: jest.fn() };
  serviceWorkerListeners = [];
  permission = 'default';
  requestPermission = jest.fn(async () => permission);

  const registration = { active: worker, pushManager: { getSubscription: async () => null } };
  globals.window = globalThis;
  globals.isSecureContext = true;
  globals.PushManager = function PushManager() {};
  globals.Notification = {
    get permission() {
      return permission;
    },
    requestPermission: () => requestPermission(),
  };
  globals.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  clickListeners = new Set();
  globals.document = {
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener: (type: string, listener: () => void) => type === 'click' && clickListeners.add(listener),
    removeEventListener: (type: string, listener: () => void) => type === 'click' && clickListeners.delete(listener),
  };
  globals.electronAPI = undefined;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        controller: null,
        ready: Promise.resolve(registration),
        register: jest.fn(async () => registration),
        getRegistrations: jest.fn(async () => [registration]),
        addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => serviceWorkerListeners.push(listener),
        removeEventListener: jest.fn(),
      },
    },
  });
}

function load(): { push: Module; hooks: Hooks } {
  let loaded!: { push: Module; hooks: Hooks };
  jest.isolateModules(() => {
    loaded = { push: require('../web-push.web'), hooks: require('@/lib/auth/sign-out-hooks') };
  });
  return loaded;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.auth = { status: 'signedIn', accessToken: 'access-token', userId: 'user-1' };
  mockState.core = { config: { ...firebaseConfig } };
  mockState.security = { rights: { DepartmentCode: 'DEPT' } };
  installBrowser();
  globals.fetch = jest.fn(async () => ({ ok: true }));
});

describe('browser', () => {
  it('registers nothing, and never asks, while Core has no Firebase web app configured', async () => {
    mockState.core.config = null;
    permission = 'granted';
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    clickPage();

    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("registers its FCM web token on the person's user subscriber as soon as the browser has permission, with no setting of its own", async () => {
    permission = 'granted';
    const { push } = load();

    await push.syncWebPush();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(mockFirebaseGetToken).toHaveBeenCalledWith('messaging', expect.objectContaining({ vapidKey: 'BVapid' }));
    expect(mockRegisterDevice).toHaveBeenCalledWith({ UserId: 'user-1', Token: 'browser-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' });
  });

  it('asks for permission once, on the first click after sign-in, then registers', async () => {
    requestPermission.mockImplementation(async () => (permission = 'granted'));
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();

    clickPage();
    await new Promise((resolve) => setImmediate(resolve));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(mockRegisterDevice).toHaveBeenCalledWith({ UserId: 'user-1', Token: 'browser-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' });

    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('waits a week before asking again after the prompt is dismissed', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { push } = load();

    push.askForPermissionOnce();
    clickPage();
    await new Promise((resolve) => setImmediate(resolve));
    expect(requestPermission).toHaveBeenCalledTimes(1);

    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 8 * 24 * 60 * 60 * 1000);
    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('neither asks nor registers once the person has blocked notifications', async () => {
    permission = 'denied';
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    clickPage();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('re-registers an unchanged token only once a day', async () => {
    permission = 'granted';
    const { push } = load();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await push.syncWebPush();
    await push.syncWebPush();
    expect(mockRegisterDevice).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 25 * 60 * 60 * 1000);
    await push.syncWebPush();
    expect(mockRegisterDevice).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('takes the device off the previous department and rotates the token before registering in the new one', async () => {
    permission = 'granted';
    const { push } = load();
    await push.syncWebPush();
    mockFirebaseGetToken.mockResolvedValue('rotated-token');

    mockState.security = { rights: { DepartmentCode: 'OTHER' } };
    await push.syncWebPush();

    expect(mockUnRegisterWebPush).toHaveBeenCalledWith({ Token: 'browser-token', Prefix: 'DEPT' });
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterDevice).toHaveBeenLastCalledWith({ UserId: 'user-1', Token: 'rotated-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'OTHER' });
    mockFirebaseGetToken.mockResolvedValue('browser-token');
  });

  it("kills the previous person's token and registers the next on a fresh one", async () => {
    permission = 'granted';
    const { push } = load();
    await push.syncWebPush();
    mockFirebaseGetToken.mockResolvedValue('rotated-token');

    mockState.auth = { status: 'signedIn', accessToken: 'second-token', userId: 'user-2' };
    await push.syncWebPush();

    // This session can't speak for the previous person; deleting the token at FCM is what stops it.
    expect(mockUnRegisterWebPush).not.toHaveBeenCalled();
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterDevice).toHaveBeenLastCalledWith({ UserId: 'user-2', Token: 'rotated-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' });
    mockFirebaseGetToken.mockResolvedValue('browser-token');
  });

  it('unregisters straight to the server and kills the token at sign-out, while the session still works', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();

    await hooks.runSignOutHooks('access-token');

    expect(globals.fetch).toHaveBeenCalledWith('https://api.test/api/v4/Devices/UnRegisterWebPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token', 'X-Resgrid-Client': 'dispatch' },
      body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT' }),
    });
    expect(mockUnRegisterWebPush).not.toHaveBeenCalled();
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('still kills the token when the sign-out call fails', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    (globals.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await hooks.runSignOutHooks('access-token');

    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
  });

});

describe('desktop', () => {
  let bridge: Record<string, jest.Mock>;

  beforeEach(() => {
    bridge = {
      pushStart: jest.fn(async () => ({ token: 'desktop-token' })),
      pushStop: jest.fn(async () => undefined),
      pushTakePendingClick: jest.fn(async () => null),
      onPushReceived: jest.fn(() => () => undefined),
      onPushNotificationClick: jest.fn(() => () => undefined),
    };
    globals.electronAPI = bridge;
  });

  it('registers the token its main process hands back, without asking (the OS handles permission)', async () => {
    const { push } = load();

    await push.syncWebPush();

    expect(bridge.pushStart).toHaveBeenCalledWith({ apiKey: 'api-key', authDomain: undefined, projectId: 'resgrid-web', messagingSenderId: '343968022249', appId: '1:343968022249:web:abc', vapidKey: 'BVapid' });
    expect(mockRegisterDevice).toHaveBeenCalledWith({ UserId: 'user-1', Token: 'desktop-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' });
    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('forgets its credentials at sign-out', async () => {
    const { push, hooks } = load();
    await push.syncWebPush();

    await hooks.runSignOutHooks('access-token');

    expect(bridge.pushStop).toHaveBeenCalledWith(true);
  });

  it('registers nothing when the main process could not start', async () => {
    bridge.pushStart.mockResolvedValue({ error: 'PHONE_REGISTRATION_ERROR' });
    const { push } = load();

    await push.syncWebPush();

    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('routes a notification click the main process kept for the page', async () => {
    bridge.pushTakePendingClick.mockResolvedValue({ title: 'Fire', body: '', eventCode: 'C:42' });
    const { push } = load();

    push.attachWebPushListeners();
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '42' } }, expect.anything());
  });
});

describe('clicks and foreground pushes', () => {
  it('opens a call or a chat like a tap on the phone, and anything else as the in-app alert', async () => {
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C1234' });
    expect(mockRouterPushWithRetry).toHaveBeenLastCalledWith({ pathname: '/call/[id]', params: { id: '1234' } }, expect.anything());

    await push.openWebPush({ title: 'Chat', body: '', eventCode: 't:abc-123' });
    expect(mockRouterPushWithRetry).toHaveBeenLastCalledWith({ pathname: '/chat/[channelId]', params: { channelId: 'abc-123' } }, expect.anything());

    await push.openWebPush({ title: 'Message', body: 'Hello', eventCode: 'M:5' });
    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'M:5', title: 'Message', body: 'Hello' }));
  });

  it('refuses an id that would steer the router elsewhere', async () => {
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C:../admin' });

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    expect(mockShowNotificationModal).toHaveBeenCalled();
  });

  it('falls back to the in-app alert when the route never lands', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('not ready'));
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C:7' });

    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:7' }));
  });

  it('takes the service worker clicks and shows a push only to a page in front of the person', async () => {
    const { push } = load();
    push.attachWebPushListeners();
    await new Promise((resolve) => setImmediate(resolve));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'CLIENT_READY' });

    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'NOTIFICATION_CLICK', data: { title: 'Fire', body: '', eventCode: 'C:9' } } }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '9' } }, expect.anything());

    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'PUSH_RECEIVED', data: { title: 'Msg', body: '', eventCode: 'M:1' } } }));
    expect(mockShowNotificationModal).toHaveBeenCalledTimes(1);

    globals.document = { visibilityState: 'hidden', hasFocus: () => false };
    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'PUSH_RECEIVED', data: { title: 'Msg', body: '', eventCode: 'M:2' } } }));
    expect(mockShowNotificationModal).toHaveBeenCalledTimes(1);
  });
});
