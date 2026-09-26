import { act } from '@testing-library/react-native';

// Hub events are delivered through the service's event bus; this stand-in keeps real listeners so the tests can
// raise pushes and lifecycle signals exactly as the service would.
const mockListeners = new Map<string, Set<(...args: unknown[]) => void>>();
const mockEmit = (event: string, ...args: unknown[]) => {
  Array.from(mockListeners.get(event) ?? []).forEach((listener) => listener(...args));
};

jest.mock('@/services/signalr.service', () => {
  const instance = {
    connectToHubWithEventingUrl: jest.fn(),
    disconnectFromHub: jest.fn(),
    invoke: jest.fn(),
    on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (!mockListeners.has(event)) mockListeners.set(event, new Set());
      mockListeners.get(event)!.add(listener);
    }),
    off: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      mockListeners.get(event)?.delete(listener);
    }),
    isHubConnected: jest.fn(),
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

import { signalRService } from '@/services/signalr.service';

import { useSignalRStore } from '../signalr-store';

const HUB = 'geolocationHub';
const mockService = signalRService as unknown as {
  connectToHubWithEventingUrl: jest.Mock;
  disconnectFromHub: jest.Mock;
  invoke: jest.Mock;
  isHubConnected: jest.Mock;
};

const joinCalls = () => mockService.invoke.mock.calls.filter(([hub, method]) => hub === HUB && method === 'GeolocationConnect');

/** Lets pending promise continuations (the join invoke and its bookkeeping) run. */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

const unitPush = (overrides: Record<string, unknown> = {}) => ({ departmentId: 123, unitId: '12', latitude: 39.5, longitude: -119.8, recordId: 'r1', timestamp: '2026-09-25T14:03:11.000Z', ...overrides });

describe('useSignalRStore geolocation hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    // A real start raises the connected lifecycle signal before connectToHubWithEventingUrl resolves.
    mockService.connectToHubWithEventingUrl.mockImplementation(async (config: { name: string }) => {
      mockEmit(`__hubConnected:${config.name}`, config.name);
    });
    mockService.disconnectFromHub.mockResolvedValue(undefined);
    mockService.invoke.mockResolvedValue(undefined);
    mockService.isHubConnected.mockReturnValue(true);
    useSignalRStore.setState({ isGeolocationHubConnected: false, liveLocations: {}, lastGeolocationMessage: null, lastGeolocationTimestamp: 0, lastGeolocationJoinTimestamp: 0, error: null });
  });

  afterEach(async () => {
    await act(async () => {
      await useSignalRStore.getState().disconnectGeolocationHub();
    });
    jest.useRealTimers();
  });

  const connect = async () => {
    await act(async () => {
      await useSignalRStore.getState().connectGeolocationHub();
    });
  };

  describe('connect', () => {
    it('opens the geolocation hub, subscribes to its pushes and joins with zero arguments', async () => {
      await connect();

      expect(mockService.connectToHubWithEventingUrl).toHaveBeenCalledWith({
        name: HUB,
        eventingUrl: 'https://eventing.example.com/',
        hubName: HUB,
        methods: expect.arrayContaining(['onUnitLocationUpdated', 'onPersonnelLocationUpdated', 'onGeolocationConnect']),
      });
      expect(joinCalls()).toEqual([[HUB, 'GeolocationConnect']]);
    });

    it('joins explicitly when the service already had the hub open', async () => {
      mockService.connectToHubWithEventingUrl.mockResolvedValue(undefined);

      await connect();

      expect(joinCalls()).toHaveLength(1);
    });

    it('reports connected only after the hub acknowledges the join', async () => {
      await connect();
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      act(() => mockEmit('onGeolocationConnect', 'connection-1'));

      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(true);
      expect(useSignalRStore.getState().lastGeolocationJoinTimestamp).toBeGreaterThan(0);
    });

    it('does not let a stale connected flag block a repair', async () => {
      useSignalRStore.setState({ isGeolocationHubConnected: true });
      mockService.isHubConnected.mockReturnValue(false);

      await connect();

      expect(mockService.connectToHubWithEventingUrl).toHaveBeenCalledTimes(1);
      expect(joinCalls()).toHaveLength(1);
    });

    it('skips reconnecting while the flag and the transport agree it is up', async () => {
      useSignalRStore.setState({ isGeolocationHubConnected: true });

      await connect();

      expect(mockService.connectToHubWithEventingUrl).not.toHaveBeenCalled();
    });
  });

  describe('reconnect paths', () => {
    it('re-joins after the client automatic reconnect', async () => {
      await connect();
      act(() => mockEmit('onGeolocationConnect', 'connection-1'));

      act(() => mockEmit(`__hubReconnecting:${HUB}`, HUB));
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      await act(async () => {
        mockEmit(`__hubReconnected:${HUB}`, HUB);
        await flush();
      });

      expect(joinCalls()).toHaveLength(2);
    });

    it("re-joins after the service's rebuild following a close (fresh token, new connection)", async () => {
      await connect();
      act(() => mockEmit('onGeolocationConnect', 'connection-1'));

      act(() => mockEmit(`__hubDisconnected:${HUB}`, HUB));
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      await act(async () => {
        mockEmit(`__hubConnected:${HUB}`, HUB);
        await flush();
      });

      expect(joinCalls()).toHaveLength(2);
    });

    it('retries a failed join and gives up after the retry budget', async () => {
      jest.useFakeTimers();
      mockService.invoke.mockRejectedValue(new Error('not connected'));

      await connect();
      expect(joinCalls()).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flush();
      });
      expect(joinCalls()).toHaveLength(2);

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await flush();
      });
      expect(joinCalls()).toHaveLength(3);

      await act(async () => {
        jest.advanceTimersByTime(20000);
        await flush();
      });
      expect(joinCalls()).toHaveLength(3);
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);
    });

    it('does not retry a join for a connection that has since dropped', async () => {
      jest.useFakeTimers();
      mockService.invoke.mockRejectedValue(new Error('not connected'));

      await connect();
      act(() => mockEmit(`__hubDisconnected:${HUB}`, HUB));

      await act(async () => {
        jest.advanceTimersByTime(20000);
        await flush();
      });

      expect(joinCalls()).toHaveLength(1);
    });
  });

  describe('location pushes', () => {
    it('stores unit and personnel positions per pin', async () => {
      await connect();

      act(() => {
        mockEmit('onUnitLocationUpdated', unitPush());
        mockEmit('onPersonnelLocationUpdated', JSON.stringify({ UserId: 'ABC-def', Latitude: 40, Longitude: -120 }));
      });

      const { liveLocations } = useSignalRStore.getState();
      expect(liveLocations.u12).toMatchObject({ pinId: 'u12', latitude: 39.5, longitude: -119.8, timestamp: Date.parse('2026-09-25T14:03:11.000Z') });
      expect(liveLocations['pabc-def']).toMatchObject({ latitude: 40, longitude: -120, timestamp: null });
    });

    it('keeps every entity from one burst instead of the last message only', async () => {
      await connect();

      act(() => {
        mockEmit('onUnitLocationUpdated', unitPush({ unitId: '1' }));
        mockEmit('onUnitLocationUpdated', unitPush({ unitId: '2' }));
        mockEmit('onUnitLocationUpdated', unitPush({ unitId: '3' }));
      });

      expect(Object.keys(useSignalRStore.getState().liveLocations).sort()).toEqual(['u1', 'u2', 'u3']);
    });

    it('ignores a fix older than the one already applied', async () => {
      await connect();
      act(() => mockEmit('onUnitLocationUpdated', unitPush({ latitude: 39.5, timestamp: '2026-09-25T14:03:11.000Z' })));
      const before = useSignalRStore.getState().liveLocations;

      act(() => mockEmit('onUnitLocationUpdated', unitPush({ latitude: 38, timestamp: '2026-09-25T14:00:00.000Z' })));

      expect(useSignalRStore.getState().liveLocations).toBe(before);
      expect(useSignalRStore.getState().liveLocations.u12.latitude).toBe(39.5);
    });

    it('ignores unusable pushes', async () => {
      await connect();

      act(() => {
        mockEmit('onUnitLocationUpdated', unitPush({ latitude: 0, longitude: 0 }));
        mockEmit('onPersonnelLocationUpdated', 'not json');
      });

      expect(useSignalRStore.getState().liveLocations).toEqual({});
    });

    it('stops listening after disconnect and forgets positions on clear', async () => {
      await connect();
      act(() => mockEmit('onUnitLocationUpdated', unitPush()));

      await act(async () => {
        await useSignalRStore.getState().disconnectGeolocationHub();
      });
      expect(mockService.disconnectFromHub).toHaveBeenCalledWith(HUB);
      expect(useSignalRStore.getState().isGeolocationHubConnected).toBe(false);

      act(() => mockEmit('onUnitLocationUpdated', unitPush({ unitId: '99' })));
      expect(useSignalRStore.getState().liveLocations.u99).toBeUndefined();

      act(() => useSignalRStore.getState().clearLiveLocations());
      expect(useSignalRStore.getState().liveLocations).toEqual({});
    });
  });
});
