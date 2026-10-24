// Hub events are delivered through the service's event bus; this stand-in keeps real listeners so the tests can
// raise `unitActiveRolesUpdated` exactly as the service would.
const mockListeners = new Map<string, Set<(...args: unknown[]) => void>>();
const mockEmit = (event: string, ...args: unknown[]) => {
  Array.from(mockListeners.get(event) ?? []).forEach((listener) => listener(...args));
};

jest.mock('@/services/signalr.service', () => {
  const instance = {
    connectToHubWithEventingUrl: jest.fn().mockResolvedValue(undefined),
    disconnectFromHub: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (!mockListeners.has(event)) mockListeners.set(event, new Set());
      mockListeners.get(event)!.add(listener);
    }),
    off: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      mockListeners.get(event)?.delete(listener);
    }),
    isHubConnected: jest.fn(() => true),
    getTotalEventListenerCount: jest.fn(() => 0),
  };
  return {
    signalRService: instance,
    SignalRService: {
      HUB_CONNECTED_EVENT: '__hubConnected',
      HUB_RECONNECTED_EVENT: '__hubReconnected',
      HUB_RECONNECTING_EVENT: '__hubReconnecting',
      HUB_DISCONNECTED_EVENT: '__hubDisconnected',
    },
  };
});

jest.mock('../../app/core-store', () => ({
  useCoreStore: {
    getState: () => ({ config: { EventingUrl: 'https://eventing.example.com/' } }),
  },
}));

jest.mock('../../security/store', () => ({
  securityStore: { getState: () => ({ rights: { DepartmentId: '123' } }) },
  useSecurityStore: { getState: () => ({ rights: { DepartmentId: '123' } }) },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/env', () => ({
  Env: {
    CHANNEL_HUB_NAME: 'eventingHub',
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
    CHAT_HUB_NAME: 'chatHub',
  },
}));

jest.mock('@/lib', () => ({
  useAuthStore: { getState: jest.fn(() => ({ accessToken: 'mock-token' })) },
}));

type Store = typeof import('../signalr-store').useSignalRStore;

describe('useSignalRStore unitActiveRolesUpdated', () => {
  let useSignalRStore: Store;

  beforeEach(() => {
    jest.resetModules();
    mockListeners.clear();
    useSignalRStore = require('../signalr-store').useSignalRStore;
  });

  afterEach(async () => {
    await useSignalRStore.getState().disconnectUpdateHub();
  });

  it('subscribes to the hub method on the update hub', async () => {
    await useSignalRStore.getState().connectUpdateHub();

    const { signalRService } = require('@/services/signalr.service');
    expect(signalRService.connectToHubWithEventingUrl).toHaveBeenCalledWith(expect.objectContaining({ methods: expect.arrayContaining(['unitActiveRolesUpdated']) }));
    expect(mockListeners.get('unitActiveRolesUpdated')?.size).toBe(1);
  });

  it('marks the units as changed so the console refetches their crews, and the live maps their pins', async () => {
    await useSignalRStore.getState().connectUpdateHub();
    const before = useSignalRStore.getState();

    mockEmit('unitActiveRolesUpdated', '12');

    const after = useSignalRStore.getState();
    expect(after.lastUnitsUpdateTimestamp).toBeGreaterThan(0);
    expect(after.lastUnitsUpdateTimestamp).toBeGreaterThanOrEqual(before.lastUnitsUpdateTimestamp);
    expect(after.lastUpdateTimestamp).toBeGreaterThan(0);
    expect(after.lastEventType).toBe('unitActiveRolesUpdated');
  });

  it('stops listening when the update hub disconnects', async () => {
    await useSignalRStore.getState().connectUpdateHub();
    await useSignalRStore.getState().disconnectUpdateHub();

    expect(mockListeners.get('unitActiveRolesUpdated')?.size ?? 0).toBe(0);
  });
});
