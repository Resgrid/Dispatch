import { type HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';

import { type SignalRHubConnectConfig, SignalRService, signalRService } from '../signalr.service';

jest.mock('@/lib/env', () => ({
  Env: {
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
  },
}));

jest.mock('@/stores/auth/store', () => {
  const mockGetState = jest.fn(() => ({
    accessToken: 'mock-token',
    refreshAccessToken: jest.fn().mockResolvedValue(undefined),
  }));
  return {
    __esModule: true,
    default: { getState: mockGetState },
    useAuthStore: { getState: mockGetState },
  };
});

jest.mock('@microsoft/signalr');
jest.mock('@/lib/logging');

const mockHubConnectionBuilder = HubConnectionBuilder as jest.MockedClass<typeof HubConnectionBuilder>;

const geoConfig: SignalRHubConnectConfig = {
  name: 'geolocationHub',
  eventingUrl: 'https://api.example.com/',
  hubName: 'geolocationHub',
  methods: ['onUnitLocationUpdated', 'onPersonnelLocationUpdated', 'onGeolocationConnect'],
};

describe('SignalRService lifecycle signals used by the geolocation hub', () => {
  let connections: jest.Mocked<HubConnection>[];

  const buildConnection = (): jest.Mocked<HubConnection> =>
    ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      invoke: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      onclose: jest.fn(),
      onreconnecting: jest.fn(),
      onreconnected: jest.fn(),
      state: HubConnectionState.Connected,
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (signalRService as any).connections.clear();
    (signalRService as any).reconnectAttempts.clear();
    (signalRService as any).hubConfigs.clear();
    (signalRService as any).connectionLocks.clear();
    (signalRService as any).reconnectingHubs.clear();
    (signalRService as any).hubStates.clear();
    signalRService.removeAllListeners();

    connections = [];
    mockHubConnectionBuilder.mockImplementation(
      () =>
        ({
          withUrl: jest.fn().mockReturnThis(),
          withAutomaticReconnect: jest.fn().mockReturnThis(),
          withServerTimeout: jest.fn().mockReturnThis(),
          configureLogging: jest.fn().mockReturnThis(),
          build: jest.fn(() => {
            const connection = buildConnection();
            connections.push(connection);
            return connection;
          }),
        }) as any
    );
  });

  it('invokes a hub method with no arguments when none are given', async () => {
    await signalRService.connectToHubWithEventingUrl(geoConfig);

    await signalRService.invoke('geolocationHub', 'GeolocationConnect');

    expect(connections[0].invoke).toHaveBeenCalledWith('GeolocationConnect');
    expect(connections[0].invoke.mock.calls[0]).toHaveLength(1);
  });

  it('announces every new connection so subscribers can re-join their groups', async () => {
    const onConnected = jest.fn();
    signalRService.on(`${SignalRService.HUB_CONNECTED_EVENT}:geolocationHub`, onConnected);

    await signalRService.connectToHubWithEventingUrl(geoConfig);

    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('announces reconnecting and reconnected from the automatic reconnect', async () => {
    const onReconnecting = jest.fn();
    const onReconnected = jest.fn();
    signalRService.on(`${SignalRService.HUB_RECONNECTING_EVENT}:geolocationHub`, onReconnecting);
    signalRService.on(`${SignalRService.HUB_RECONNECTED_EVENT}:geolocationHub`, onReconnected);

    await signalRService.connectToHubWithEventingUrl(geoConfig);
    const reconnectingHandler = connections[0].onreconnecting.mock.calls[0][0];
    const reconnectedHandler = connections[0].onreconnected.mock.calls[0][0];

    reconnectingHandler(new Error('transport lost'));
    reconnectedHandler('connection-2');

    expect(onReconnecting).toHaveBeenCalledTimes(1);
    expect(onReconnected).toHaveBeenCalledTimes(1);
  });

  it('announces the rebuild after a close (e.g. token expiry) as a new connection', async () => {
    jest.useFakeTimers();
    try {
      const onConnected = jest.fn();
      signalRService.on(`${SignalRService.HUB_CONNECTED_EVENT}:geolocationHub`, onConnected);

      await signalRService.connectToHubWithEventingUrl(geoConfig);
      (connections[0] as any).state = HubConnectionState.Disconnected;
      const closeHandler = connections[0].onclose.mock.calls[0][0];

      closeHandler(new Error('authentication expired'));
      await jest.advanceTimersByTimeAsync(5000);

      expect(connections).toHaveLength(2);
      expect(onConnected).toHaveBeenCalledTimes(2);
    } finally {
      signalRService.removeAllListeners();
      (signalRService as any).cancelAllPendingReconnects();
      jest.useRealTimers();
    }
  });

  it('rebuilds a connection that closed while the page was hidden when it becomes visible again', async () => {
    const onConnected = jest.fn();
    signalRService.on(`${SignalRService.HUB_CONNECTED_EVENT}:geolocationHub`, onConnected);

    await signalRService.connectToHubWithEventingUrl(geoConfig);
    // The close happened while hidden, so the scheduled rebuild skipped and left the dead entry mapped.
    (connections[0] as any).state = HubConnectionState.Disconnected;

    await (signalRService as any).checkAndReconnectOnVisibilityResume();

    expect(connections).toHaveLength(2);
    expect(connections[1].start).toHaveBeenCalled();
    expect(signalRService.isHubConnected('geolocationHub')).toBe(true);
    expect(onConnected).toHaveBeenCalledTimes(2);
  });

  it('falls back to the token-refreshing rebuild when the visibility-resume connect fails', async () => {
    jest.useFakeTimers();
    try {
      await signalRService.connectToHubWithEventingUrl(geoConfig);
      (connections[0] as any).state = HubConnectionState.Disconnected;
      let failNextStart = true;
      mockHubConnectionBuilder.mockImplementation(
        () =>
          ({
            withUrl: jest.fn().mockReturnThis(),
            withAutomaticReconnect: jest.fn().mockReturnThis(),
            withServerTimeout: jest.fn().mockReturnThis(),
            configureLogging: jest.fn().mockReturnThis(),
            build: jest.fn(() => {
              const connection = buildConnection();
              if (failNextStart) {
                failNextStart = false;
                connection.start.mockRejectedValue(new Error('401 Unauthorized'));
              }
              connections.push(connection);
              return connection;
            }),
          }) as any
      );

      await (signalRService as any).checkAndReconnectOnVisibilityResume();
      expect(signalRService.isHubConnected('geolocationHub')).toBe(false);

      await jest.advanceTimersByTimeAsync(5000);

      expect(connections).toHaveLength(3);
      expect(signalRService.isHubConnected('geolocationHub')).toBe(true);
    } finally {
      (signalRService as any).cancelAllPendingReconnects();
      jest.useRealTimers();
    }
  });

  it('leaves a connection that is still inside its automatic reconnect alone on visibility resume', async () => {
    await signalRService.connectToHubWithEventingUrl(geoConfig);
    (connections[0] as any).state = HubConnectionState.Reconnecting;

    await (signalRService as any).checkAndReconnectOnVisibilityResume();

    expect(connections).toHaveLength(1);
  });
});
