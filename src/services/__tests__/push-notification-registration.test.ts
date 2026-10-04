/**
 * Dispatch registers the dispatcher's own devices on their user subscriber (RegisterDevice), the one its notification
 * inbox reads. It used to register as a unit and wait for an active unit Dispatch never sets, so it never registered.
 */
import * as Notifications from 'expo-notifications';


// Mock expo-device so tests don't attempt to load native modules
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  removeNotificationSubscription: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  AndroidImportance: { MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
}));

// Mock auth module: the deep links gate the cold-start push on a hydrated session, so the
// mock has to answer getState() as well as being callable as a selector hook.
jest.mock('@/lib/auth', () => {
  const state = { status: 'signedIn', userId: 'test-user' };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { useAuthStore: store };
});

// Mock the retrying router helper used for chat/call push deep links
jest.mock('@/lib/navigation', () => ({
  routerPushWithRetry: jest.fn(() => Promise.resolve()),
  registerNavigationReadyCheck: jest.fn(),
  isNavigationReady: jest.fn(() => true),
}));

// Treat the test platform as a native push platform so the service registers listeners
jest.mock('@/lib/platform', () => ({
  isElectron: jest.fn(() => false),
  isNativePushSupported: jest.fn(() => true),
  isDesktopNotificationSupported: jest.fn(() => false),
}));

// Mock the store, keeping the real parseNotificationData so eventCode routing stays realistic
jest.mock('@/stores/push-notification/store', () => ({
  ...jest.requireActual('@/stores/push-notification/store'),
  usePushNotificationModalStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/services/audio.service', () => ({
  audioService: {
    playNotificationSound: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/electron-notification', () => ({
  electronNotificationService: {
    initialize: jest.fn(() => Promise.resolve()),
    sendTestNotification: jest.fn(),
    showNotification: jest.fn(),
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    getBoolean: jest.fn(() => undefined),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'test-uuid'),
}));

jest.mock('@/api/devices/push', () => ({
  registerDevice: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/stores/app/core-store', () => {
  const state = { activeUnitId: 'test-unit' };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { useCoreStore: store };
});

jest.mock('@/stores/security/store', () => {
  const state = { rights: { DepartmentCode: 'TEST' } };
  const store: unknown = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { securityStore: store };
});

type PushService = typeof import('../push-notification');

const { registerDevice } = jest.requireMock('@/api/devices/push') as { registerDevice: jest.Mock };

let pushNotificationService: PushService['pushNotificationService'];

beforeAll(() => {
  (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  pushNotificationService = (require('../push-notification') as PushService).pushNotificationService;
});

beforeEach(() => {
  registerDevice.mockClear();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({ type: 'ios', data: 'apns-device-token' });
});

describe('registerForPushNotifications', () => {
  it("registers the token on the dispatcher's user subscriber, with no unit", async () => {
    await expect(pushNotificationService.registerForPushNotifications('user-1', 'DEPT')).resolves.toBe('apns-device-token');

    expect(registerDevice).toHaveBeenCalledWith({ UserId: 'user-1', Token: 'apns-device-token', Platform: 1, DeviceUuid: 'test-uuid', Prefix: 'DEPT' });
  });

  it('registers nothing without permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await expect(pushNotificationService.registerForPushNotifications('user-1', 'DEPT')).resolves.toBeNull();
    expect(registerDevice).not.toHaveBeenCalled();
  });
});
