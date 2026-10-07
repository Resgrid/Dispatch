// Hub events are delivered through the service's event bus; this stand-in keeps real listeners so the tests can
// raise lifecycle signals exactly as the service would.
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

jest.mock('../../incident-command/store', () => ({
  useIncidentCommandStore: { getState: () => ({ callId: null, handleIncidentCommandUpdated: jest.fn() }) },
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

/** Lets pending promise continuations (the rejoin invoke and its bookkeeping) run. */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

const boardTimestamps = (store: Store) => {
  const { lastUnitsUpdateTimestamp, lastCallsUpdateTimestamp, lastPersonnelUpdateTimestamp } = store.getState();
  return { lastUnitsUpdateTimestamp, lastCallsUpdateTimestamp, lastPersonnelUpdateTimestamp };
};

describe('useSignalRStore update hub re-join', () => {
  let useSignalRStore: Store;
  let now = 1_000;

  beforeEach(() => {
    // The "has joined before" flag is module state; every test starts from a fresh session.
    jest.resetModules();
    mockListeners.clear();
    now = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    useSignalRStore = require('../signalr-store').useSignalRStore;
  });

  afterEach(async () => {
    await useSignalRStore.getState().disconnectUpdateHub();
    jest.restoreAllMocks();
  });

  const connect = () => useSignalRStore.getState().connectUpdateHub();

  it('does not nudge the board on the first join', async () => {
    await connect();

    expect(boardTimestamps(useSignalRStore)).toEqual({ lastUnitsUpdateTimestamp: 0, lastCallsUpdateTimestamp: 0, lastPersonnelUpdateTimestamp: 0 });
  });

  it('refetches units, calls and personnel once the group is re-joined after an automatic reconnect', async () => {
    await connect();
    now = 5_000;

    mockEmit('__hubReconnected:eventingHub', 'eventingHub');
    await flush();

    expect(boardTimestamps(useSignalRStore)).toEqual({ lastUnitsUpdateTimestamp: 5_000, lastCallsUpdateTimestamp: 5_000, lastPersonnelUpdateTimestamp: 5_000 });
    // Not attributed to a push that did not happen.
    expect(useSignalRStore.getState().lastEventType).toBeNull();
    expect(useSignalRStore.getState().isUpdateHubConnected).toBe(true);
  });

  it('does not nudge when the re-join fails', async () => {
    await connect();
    const { signalRService } = require('@/services/signalr.service');
    (signalRService.invoke as jest.Mock).mockRejectedValueOnce(new Error('not joined'));
    now = 5_000;

    mockEmit('__hubReconnected:eventingHub', 'eventingHub');
    await flush();

    expect(boardTimestamps(useSignalRStore).lastUnitsUpdateTimestamp).toBe(0);
  });

  it('refetches the board when the hub is connected again after a disconnect (resume, unlock)', async () => {
    await connect();
    await useSignalRStore.getState().disconnectUpdateHub();
    now = 9_000;

    await connect();

    expect(boardTimestamps(useSignalRStore)).toEqual({ lastUnitsUpdateTimestamp: 9_000, lastCallsUpdateTimestamp: 9_000, lastPersonnelUpdateTimestamp: 9_000 });
  });
});
