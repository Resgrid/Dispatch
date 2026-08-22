import * as Notifications from 'expo-notifications';

import { routerPushWithRetry } from '@/lib/navigation';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';

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
  registerUnitDevice: jest.fn(),
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

const mockShowNotificationModal = jest.fn();
const mockGetState = usePushNotificationModalStore.getState as jest.Mock;
const mockRouterPushWithRetry = routerPushWithRetry as jest.Mock;

let notificationReceivedHandler: (notification: Notifications.Notification) => void;
let notificationResponseHandler: (response: Notifications.NotificationResponse) => void;
let extractPushNotificationData: PushService['extractPushNotificationData'];
let handleChatDeepLink: PushService['handleChatDeepLink'];
let pushNotificationService: PushService['pushNotificationService'];

beforeAll(() => {
  mockGetState.mockReturnValue({
    showNotificationModal: mockShowNotificationModal,
  });

  (Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation((handler) => {
    notificationReceivedHandler = handler;
    return { remove: jest.fn() };
  });

  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((handler) => {
    notificationResponseHandler = handler;
    return { remove: jest.fn() };
  });

  // Import and initialize the service after mocks are set up

  const service = require('../push-notification') as PushService;
  extractPushNotificationData = service.extractPushNotificationData;
  handleChatDeepLink = service.handleChatDeepLink;
  pushNotificationService = service.pushNotificationService;
});

beforeEach(() => {
  mockShowNotificationModal.mockClear();
  mockRouterPushWithRetry.mockClear();
  mockGetState.mockReturnValue({
    showNotificationModal: mockShowNotificationModal,
  });
});

interface MockNotificationInput {
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
}

const createMockNotification = (input: MockNotificationInput, triggerPayload?: Record<string, unknown>): Notifications.Notification =>
  ({
    date: Date.now(),
    request: {
      identifier: 'test-id',
      content: {
        title: input.title || null,
        subtitle: null,
        body: input.body || null,
        data: input.data ?? {},
        sound: null,
      },
      trigger: triggerPayload === undefined ? null : { type: 'push', payload: triggerPayload },
    },
  }) as unknown as Notifications.Notification;

let responseCounter = 0;
const createMockResponse = (input: MockNotificationInput, triggerPayload?: Record<string, unknown>): Notifications.NotificationResponse => {
  responseCounter += 1;
  const notification = createMockNotification(input, triggerPayload);
  // Give each response a distinct identifier so the dedup guard treats them as separate taps.
  (notification.request as { identifier: string }).identifier = `response-${responseCounter}`;
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification,
  } as Notifications.NotificationResponse;
};

describe('handleChatDeepLink', () => {
  it.each([
    ['t:channel-1', 'channel-1'],
    ['g:9101', '9101'],
    ['T:channel-1', 'channel-1'],
    ['G:9101', '9101'],
  ])('navigates with explicit route params for %s', async (eventCode, channelId) => {
    await expect(handleChatDeepLink(eventCode)).resolves.toBe(true);
    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
  });

  it.each(['t:a/b', 't:a\\b', 'g:a?x=1', 'g:a#fragment', 'x:123', 't:', 'notacode', ':missingprefix'])('rejects invalid payload %s', async (eventCode) => {
    await expect(handleChatDeepLink(eventCode)).resolves.toBe(false);
    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
  });

  // Resolving false is what tells the tap handler to fall back to the notification modal
  // instead of leaving the app on whatever screen it opened to.
  it('resolves false when the navigation never lands', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('navigation never became ready'));

    await expect(handleChatDeepLink('t:channel-1')).resolves.toBe(false);
  });
});

describe('tap response falls back to the modal when a deep-link never lands', () => {
  type ResponseRouter = { handleResponseOnce: (response: Notifications.NotificationResponse) => Promise<void> };
  const routeResponse = (response: Notifications.NotificationResponse): Promise<void> => (pushNotificationService as unknown as ResponseRouter).handleResponseOnce(response);

  it('shows the modal when the chat deep-link exhausts its retries', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('navigation never became ready'));

    await routeResponse(createMockResponse({ title: 'Chat', body: 'Hello', data: { eventCode: 'g:9101' } }));

    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'g:9101' }));
  });

  it('shows the modal when the call deep-link exhausts its retries', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('navigation never became ready'));

    await routeResponse(createMockResponse({ title: 'Call', body: 'Structure fire', data: { eventCode: 'C:1234' } }));

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1234' } }, expect.objectContaining({ maxAttempts: 40 }));
    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:1234' }));
  });

  it('does not show the modal when the deep-link lands', async () => {
    await routeResponse(createMockResponse({ title: 'Call', body: 'Structure fire', data: { eventCode: 'C:1234' } }));

    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });
});

describe('extractPushNotificationData', () => {
  const makeRequest = (data: unknown, triggerPayload?: unknown): Notifications.NotificationRequest =>
    ({
      identifier: 'req-1',
      content: { title: 'T', body: 'B', data },
      trigger: triggerPayload === undefined ? { type: 'push' } : { type: 'push', payload: triggerPayload },
    }) as unknown as Notifications.NotificationRequest;

  it('reads eventCode from content.data (Android FCM path)', () => {
    const { eventCode, data } = extractPushNotificationData(makeRequest({ eventCode: 'g:123', other: 1 }));
    expect(eventCode).toBe('g:123');
    expect(data).toEqual({ eventCode: 'g:123', other: 1 });
  });

  it('falls back to a top-level trigger payload key (iOS APNs custom key)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest(undefined, { aps: { alert: {} }, eventCode: 't:abc', type: '13' }));
    expect(eventCode).toBe('t:abc');
  });

  it('falls back to the trigger payload body dict (iOS expo-style body key)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest(null, { aps: {}, body: { eventCode: 'C:55' } }));
    expect(eventCode).toBe('C:55');
  });

  it('falls back to an aps-nested eventCode (FCM-relayed APNs override)', () => {
    const { eventCode } = extractPushNotificationData(makeRequest({}, { aps: { category: 'chats', eventCode: 'g:77' } }));
    expect(eventCode).toBe('g:77');
  });

  it('returns undefined when no eventCode exists anywhere', () => {
    const { eventCode, data } = extractPushNotificationData(makeRequest({ foo: 'bar' }, { aps: {} }));
    expect(eventCode).toBeUndefined();
    expect(data).toEqual({ foo: 'bar' });
  });
});

describe('notification response handler (tap to open)', () => {
  it('deep-links straight to the call detail when a call notification is tapped', () => {
    const response = createMockResponse({
      title: 'Emergency Call',
      body: 'Structure fire at Main St',
      data: { eventCode: 'C:1234' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1234' } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });

  it('deep-links a legacy no-colon call eventCode to the call detail', () => {
    const response = createMockResponse({
      title: 'Emergency Call',
      body: 'Structure fire at Main St',
      data: { eventCode: 'C1234' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1234' } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });

  it('deep-links an uppercase chat eventCode to the chat channel', () => {
    const response = createMockResponse({
      title: 'Chat Message',
      body: 'New message in chat',
      data: { eventCode: 'T:9101' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId: '9101' } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });

  it('deep-links using the raw trigger payload when content.data is empty (iOS)', () => {
    const response = createMockResponse({ title: 'Emergency Call', body: 'Structure fire at Main St', data: {} }, { aps: { alert: {} }, eventCode: 'C:777' });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '777' } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });

  it('falls back to the modal for a call id containing unsafe characters', () => {
    const response = createMockResponse({
      title: 'Emergency Call',
      body: 'Structure fire at Main St',
      data: { eventCode: 'C:12/34' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    expect(mockShowNotificationModal).toHaveBeenCalledWith({
      eventCode: 'C:12/34',
      title: 'Emergency Call',
      body: 'Structure fire at Main St',
      data: { eventCode: 'C:12/34' },
    });
  });

  it('falls back to the modal for a message notification tap', () => {
    const response = createMockResponse({
      title: 'New Message',
      body: 'You have a new message from dispatch',
      data: { eventCode: 'M:5678' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    expect(mockShowNotificationModal).toHaveBeenCalledWith({
      eventCode: 'M:5678',
      title: 'New Message',
      body: 'You have a new message from dispatch',
      data: { eventCode: 'M:5678' },
    });
  });

  it('does nothing when the tapped notification has no eventCode', () => {
    const response = createMockResponse({
      title: 'Regular Notification',
      body: 'No eventCode here',
      data: { someOtherData: 'value' },
    });

    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });

  it('does not surface the same response twice (dedup guard)', () => {
    const response = createMockResponse({
      title: 'Emergency Call',
      body: 'Structure fire at Main St',
      data: { eventCode: 'C:1234' },
    });

    notificationResponseHandler(response);
    notificationResponseHandler(response);

    expect(mockRouterPushWithRetry).toHaveBeenCalledTimes(1);
  });
});

describe('notification received handler (foreground)', () => {
  it('shows the modal using the eventCode extracted from the trigger payload (iOS)', () => {
    const notification = createMockNotification({ title: 'Chat Message', body: 'New message in chat', data: {} }, { aps: {}, body: { eventCode: 't:room-1' } });

    notificationReceivedHandler(notification);

    expect(mockShowNotificationModal).toHaveBeenCalledWith({
      eventCode: 't:room-1',
      title: 'Chat Message',
      body: 'New message in chat',
      data: { eventCode: 't:room-1' },
    });
    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
  });

  it('does not show the modal when no eventCode exists anywhere', () => {
    const notification = createMockNotification({ title: 'Plain', body: 'No event code', data: { foo: 'bar' } }, { aps: {} });

    notificationReceivedHandler(notification);

    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });
});

describe('cold start (app launched from a killed state by tapping a notification)', () => {
  it('replays the launch notification and deep-links to the call detail from the trigger payload', async () => {
    const launchResponse = createMockResponse({ title: 'Emergency Call', body: 'Structure fire at Main St', data: {} }, { aps: { alert: {} }, eventCode: 'C:4321' });

    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce(launchResponse);
    mockRouterPushWithRetry.mockClear();
    mockShowNotificationModal.mockClear();

    await (pushNotificationService as unknown as { handleLaunchNotification: () => Promise<void> }).handleLaunchNotification();

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '4321' } }, expect.objectContaining({ maxAttempts: 40, retryDelayMs: 250 }));
    expect(mockShowNotificationModal).not.toHaveBeenCalled();
  });
});
