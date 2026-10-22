// Hub events are delivered through the service's event bus; this stand-in keeps real listeners so the tests can
// raise `outstandingRequirementsUpdated` exactly as the service would, with its two positional arguments.
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

const mockHandleOutstandingRequirementsUpdated = jest.fn();
jest.mock('../../awaiting-resources/store', () => ({
  useAwaitingResourcesStore: { getState: () => ({ handleOutstandingRequirementsUpdated: mockHandleOutstandingRequirementsUpdated }) },
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

describe('useSignalRStore outstandingRequirementsUpdated', () => {
  let useSignalRStore: Store;

  beforeEach(() => {
    jest.resetModules();
    mockListeners.clear();
    mockHandleOutstandingRequirementsUpdated.mockClear();
    useSignalRStore = require('../signalr-store').useSignalRStore;
  });

  afterEach(async () => {
    await useSignalRStore.getState().disconnectUpdateHub();
  });

  it('subscribes to the hub method on the update hub', async () => {
    await useSignalRStore.getState().connectUpdateHub();

    const { signalRService } = require('@/services/signalr.service');
    expect(signalRService.connectToHubWithEventingUrl).toHaveBeenCalledWith(expect.objectContaining({ methods: expect.arrayContaining(['outstandingRequirementsUpdated']) }));
    expect(mockListeners.get('outstandingRequirementsUpdated')?.size).toBe(1);
  });

  it('hands the call id and payload to the awaiting resources store', async () => {
    await useSignalRStore.getState().connectUpdateHub();
    const payload = JSON.stringify({ kind: 1, unitId: 41, calls: [{ callId: 7 }] });

    mockEmit('outstandingRequirementsUpdated', '0', payload);

    expect(mockHandleOutstandingRequirementsUpdated).toHaveBeenCalledWith('0', payload);
    expect(useSignalRStore.getState().lastOutstandingRequirementsTimestamp).toBeGreaterThan(0);
  });

  it('passes an id-only push from an older server through as well', async () => {
    await useSignalRStore.getState().connectUpdateHub();

    mockEmit('outstandingRequirementsUpdated', '7');

    expect(mockHandleOutstandingRequirementsUpdated).toHaveBeenCalledWith('7', undefined);
  });

  it('does not touch the shared update timestamp the live maps refetch on', async () => {
    await useSignalRStore.getState().connectUpdateHub();
    const before = useSignalRStore.getState().lastUpdateTimestamp;

    mockEmit('outstandingRequirementsUpdated', '7', '{"kind":0}');

    expect(useSignalRStore.getState().lastUpdateTimestamp).toBe(before);
  });

  it('stops listening when the update hub disconnects', async () => {
    await useSignalRStore.getState().connectUpdateHub();
    await useSignalRStore.getState().disconnectUpdateHub();

    mockEmit('outstandingRequirementsUpdated', '7');

    expect(mockHandleOutstandingRequirementsUpdated).not.toHaveBeenCalled();
  });
});
