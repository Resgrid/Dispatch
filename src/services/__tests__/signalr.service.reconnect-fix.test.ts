import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

import { logger } from '@/lib/logging';
import { HubConnectingState } from '../signalr.service';

// Mock the required modules
jest.mock('@/lib/env', () => ({
  Env: {
    REALTIME_GEO_HUB_NAME: 'geolocationHub',
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

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      accessToken: 'mock-token',
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: jest.fn(),
  LogLevel: {
    Information: 'Information',
  },
  HubConnectionState: {
    Connected: 'Connected',
    Disconnected: 'Disconnected',
  },
}));

// Import after mocking
import { SignalRService } from '../signalr.service';

describe('SignalRService - Reconnect Self-Blocking Fix', () => {
  let signalRService: any;
  let mockConnection: jest.Mocked<HubConnection>;
  let mockBuilderInstance: jest.Mocked<HubConnectionBuilder>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  const mockHubConnectionBuilder = HubConnectionBuilder as jest.MockedClass<typeof HubConnectionBuilder>;
  const mockStart = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    SignalRService.resetInstance();
    signalRService = SignalRService.getInstance();

    // Mock HubConnection
    mockConnection = {
      start: mockStart,
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      onclose: jest.fn(),
      onreconnecting: jest.fn(),
      onreconnected: jest.fn(),
      invoke: jest.fn().mockResolvedValue(undefined),
      state: 'Connected',
    } as any;

    // Mock HubConnectionBuilder
    mockBuilderInstance = {
      withUrl: jest.fn().mockReturnThis(),
      withAutomaticReconnect: jest.fn().mockReturnThis(),
      withServerTimeout: jest.fn().mockReturnThis(),
      configureLogging: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(mockConnection),
    } as any;

    mockHubConnectionBuilder.mockImplementation(() => mockBuilderInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockConfig = {
    name: 'testHub',
    eventingUrl: 'https://api.example.com/',
    hubName: 'eventingHub',
    methods: ['method1'],
  };

  describe('Direct connection during reconnection', () => {
    it('should allow direct connection attempts when hub is in reconnecting state', async () => {
      // Set hub to reconnecting state
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.RECONNECTING);
      
      // Verify hub is in reconnecting state
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(true);
      
      // Attempt direct connection - should not be blocked
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Should have attempted the connection
      expect(mockHubConnectionBuilder).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Hub ${mockConfig.name} is currently reconnecting, proceeding with direct connection attempt`,
      });
    });

    it('should prevent duplicate direct connections', async () => {
      // Set hub to direct-connecting state
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.DIRECT_CONNECTING);
      
      // Attempt another direct connection - should be blocked
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Should not have attempted the connection
      expect(mockHubConnectionBuilder).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: `Hub ${mockConfig.name} is already in direct-connecting state, skipping duplicate connection attempt`,
      });
    });

    it('should clean up direct-connecting state on successful connection', async () => {
      // Start with idle state
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(false);
      
      // Attempt connection
      await signalRService.connectToHubWithEventingUrl(mockConfig);
      
      // Should be back to idle state after successful connection
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(false);
      expect((signalRService as any).hubStates.get(mockConfig.name)).toBeUndefined();
    });

    it('should clean up direct-connecting state on failed connection', async () => {
      // Mock connection failure
      mockStart.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Start with idle state
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(false);
      
      // Attempt connection (should fail)
      await expect(signalRService.connectToHubWithEventingUrl(mockConfig)).rejects.toThrow('Connection failed');
      
      // Should be back to idle state after failed connection
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(false);
      expect((signalRService as any).hubStates.get(mockConfig.name)).toBeUndefined();
      
      // Reset mock for future tests
      mockStart.mockResolvedValue(undefined);
    });

    it('should maintain backward compatibility with legacy reconnectingHubs set', async () => {
      // Set hub to reconnecting state
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.RECONNECTING);
      
      // Legacy reconnectingHubs set should also be updated
      expect((signalRService as any).reconnectingHubs.has(mockConfig.name)).toBe(true);
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(true);
      
      // Clear state
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.IDLE);
      
      // Legacy set should be cleared too
      expect((signalRService as any).reconnectingHubs.has(mockConfig.name)).toBe(false);
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(false);
    });
  });

  describe('State management', () => {
    it('should distinguish between reconnecting and direct-connecting states', () => {
      // Set to reconnecting
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.RECONNECTING);
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(true);
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(true);
      
      // Set to direct-connecting
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.DIRECT_CONNECTING);
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(false);
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(true);
      
      // Set to idle
      (signalRService as any).setHubState(mockConfig.name, HubConnectingState.IDLE);
      expect(signalRService.isHubReconnecting(mockConfig.name)).toBe(false);
      expect((signalRService as any).isHubConnecting(mockConfig.name)).toBe(false);
    });

    it('should properly manage isHubAvailable with new states', () => {
      const hubName = 'testHub';
      
      // Not connected, not connecting
      expect(signalRService.isHubAvailable(hubName)).toBe(false);
      
      // Reconnecting
      (signalRService as any).setHubState(hubName, HubConnectingState.RECONNECTING);
      expect(signalRService.isHubAvailable(hubName)).toBe(true);
      
      // Direct connecting
      (signalRService as any).setHubState(hubName, HubConnectingState.DIRECT_CONNECTING);
      expect(signalRService.isHubAvailable(hubName)).toBe(true);
      
      // Add actual connection
      (signalRService as any).connections.set(hubName, mockConnection);
      (signalRService as any).setHubState(hubName, HubConnectingState.IDLE);
      expect(signalRService.isHubAvailable(hubName)).toBe(true);
      
      // Clean up
      (signalRService as any).connections.delete(hubName);
      expect(signalRService.isHubAvailable(hubName)).toBe(false);
    });
  });
});
