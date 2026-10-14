/**
 * Sign-out takes this phone's native push token off the dispatcher's user subscriber (Devices/UnRegisterNativePush),
 * so a signed-out device stops getting that person's pushes.
 */
import * as Notifications from 'expo-notifications';

import { registerDevice } from '@/api/devices/push';
import { runSignOutHooks } from '@/lib/auth/sign-out-hooks';
import { logger } from '@/lib/logging';

import type * as PushService from '../push-notification';

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: 'ios', data: 'native-token' })),
  scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  AndroidImportance: { MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
}));

jest.mock('@/lib/auth', () => {
  const state = { status: 'signedIn', userId: 'user-1' };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { useAuthStore: store };
});

jest.mock('@/lib/navigation', () => ({
  routerPushWithRetry: jest.fn(() => Promise.resolve()),
  registerNavigationReadyCheck: jest.fn(),
  isNavigationReady: jest.fn(() => true),
}));

// Treat the test platform as a native push platform, the only place a token registers here.
jest.mock('@/lib/platform', () => ({
  isElectron: jest.fn(() => false),
  isNativePushSupported: jest.fn(() => true),
  isDesktopNotificationSupported: jest.fn(() => false),
}));

jest.mock('@/stores/push-notification/store', () => ({
  ...jest.requireActual('@/stores/push-notification/store'),
  usePushNotificationModalStore: { getState: jest.fn(() => ({ showNotificationModal: jest.fn() })) },
}));

jest.mock('@/services/audio.service', () => ({
  audioService: { playNotificationSound: jest.fn(() => Promise.resolve()) },
}));

jest.mock('@/services/electron-notification', () => ({
  electronNotificationService: {
    initialize: jest.fn(() => Promise.resolve()),
    sendTestNotification: jest.fn(),
    showNotification: jest.fn(),
  },
}));

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

jest.mock('@/lib/mfa/client-app', () => ({ CLIENT_HEADER: 'X-Resgrid-Client', RESGRID_CLIENT: 'dispatch' }));

jest.mock('@/lib/storage', () => ({ storage: { getBoolean: jest.fn(() => undefined) } }));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'device-uuid'),
  getBaseApiUrl: jest.fn(() => 'https://api.example/api/v4'),
}));

jest.mock('@/api/devices/push', () => ({
  registerDevice: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/stores/app/core-store', () => {
  const state = { activeUnitId: null };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { useCoreStore: store };
});

jest.mock('@/stores/security/store', () => {
  const state = { rights: { DepartmentCode: 'DEPT' } };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { securityStore: store };
});

describe('push notification sign-out', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let pushNotificationService: typeof PushService.pushNotificationService;

  beforeAll(() => {
    pushNotificationService = (require('../push-notification') as typeof PushService).pushNotificationService;
  });

  beforeEach(async () => {
    fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    // Start every test from a clean slate: nothing registered.
    await runSignOutHooks(null);
    fetchMock.mockClear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('takes the registered token off the server as the signing-out session', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ Token: 'native-token', Prefix: 'DEPT' }));

    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/v4/Devices/UnRegisterNativePush');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer access-token', 'X-Resgrid-Client': 'dispatch' }));
    expect(JSON.parse(init.body)).toEqual({ Token: 'native-token', Prefix: 'DEPT' });
  });

  it('does not call the server when the phone never registered', async () => {
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unregisters only once per registration', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');

    await runSignOutHooks('access-token');
    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the server without an access token', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');

    await runSignOutHooks(null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets sign-out carry on when the server refuses or is unreachable', async () => {
    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 400 }));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('does not register a token when permission is refused, so there is nothing to unregister', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remembers nothing when the server never took the registration', async () => {
    (registerDevice as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    await pushNotificationService.registerForPushNotifications('user-1', 'DEPT');
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
