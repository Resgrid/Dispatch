import { act, renderHook, waitFor } from '@testing-library/react-native';

// Mock modules before importing the hook
jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: jest.fn(() => ({
    isConnected: false,
    isConnecting: false,
    currentRoom: null,
    currentRoomInfo: null,
    isVoiceEnabled: true,
    voipServerWebsocketSslAddress: 'wss://test.example.com',
    availableRooms: [
      { Id: 'room-1', Name: 'Channel 1', Token: 'token-1', IsDefault: true, ConferenceNumber: 1 },
      { Id: 'room-2', Name: 'Channel 2', Token: 'token-2', IsDefault: false, ConferenceNumber: 2 },
    ],
    fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
    connectToRoom: jest.fn().mockResolvedValue(undefined),
    disconnectFromRoom: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock CallKeep service (iOS only)
jest.mock(
  '@/services/callkeep.service.ios',
  () => ({
    callKeepService: {
      setup: jest.fn().mockResolvedValue(undefined),
      startCall: jest.fn().mockResolvedValue(undefined),
      endCall: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn(),
      setMuteStateCallback: jest.fn(),
    },
  }),
  { virtual: true }
);

// Import Platform after mocks are set up
import { Platform } from 'react-native';

import { usePTT } from '../use-ptt';
import { useLiveKitStore } from '@/stores/app/livekit-store';

// Create a typed mock reference
const mockUseLiveKitStore = useLiveKitStore as jest.MockedFunction<typeof useLiveKitStore>;

describe('usePTT hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => usePTT());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isTransmitting).toBe(false);
      expect(result.current.isMuted).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isVoiceEnabled).toBe(true);
      expect(result.current.availableChannels).toHaveLength(2);
    });

    it('should fetch voice settings on mount', async () => {
      const mockFetchVoiceSettings = jest.fn().mockResolvedValue(undefined);
      mockUseLiveKitStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: mockFetchVoiceSettings,
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      renderHook(() => usePTT());

      await waitFor(() => {
        expect(mockFetchVoiceSettings).toHaveBeenCalled();
      });
    });
  });

  describe('Channel Selection', () => {
    it('should select a channel', () => {
      const { result } = renderHook(() => usePTT());

      act(() => {
        result.current.selectChannel({
          Id: 'room-1',
          Name: 'Channel 1',
          Token: 'token-1',
          IsDefault: true,
          ConferenceNumber: 1,
        });
      });

      expect(result.current.currentChannel).toEqual({
        Id: 'room-1',
        Name: 'Channel 1',
        Token: 'token-1',
        IsDefault: true,
        ConferenceNumber: 1,
      });
    });
  });

  describe('Connection', () => {
    it('should connect to a channel', async () => {
      const mockConnectToRoom = jest.fn().mockResolvedValue(undefined);
      mockUseLiveKitStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: mockConnectToRoom,
        disconnectFromRoom: jest.fn(),
      });

      const { result } = renderHook(() => usePTT());

      const channel = {
        Id: 'room-1',
        Name: 'Channel 1',
        Token: 'token-1',
        IsDefault: true,
        ConferenceNumber: 1,
      };

      await act(async () => {
        await result.current.connect(channel);
      });

      expect(mockConnectToRoom).toHaveBeenCalledWith(channel, channel.Token);
    });

    it('should set error when voice is disabled', async () => {
      const mockFetchVoiceSettings = jest.fn().mockResolvedValue(undefined);
      mockUseLiveKitStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isVoiceEnabled: false,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: mockFetchVoiceSettings,
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => usePTT({ onError }));

      // Wait for the initial fetchVoiceSettings to complete on mount
      await waitFor(() => {
        expect(mockFetchVoiceSettings).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.connect({
          Id: 'room-1',
          Name: 'Channel 1',
          Token: 'token-1',
          IsDefault: true,
          ConferenceNumber: 1,
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Voice is not enabled for this department');
      });
      expect(onError).toHaveBeenCalledWith('Voice is not enabled for this department');
    });

    it('should disconnect from a channel', async () => {
      const mockDisconnectFromRoom = jest.fn().mockResolvedValue(undefined);
      const mockLocalParticipant = {
        setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      };
      const mockRoom = {
        localParticipant: mockLocalParticipant,
        disconnect: jest.fn().mockResolvedValue(undefined),
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: mockDisconnectFromRoom,
      });

      const { result } = renderHook(() => usePTT());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockDisconnectFromRoom).toHaveBeenCalled();
    });
  });

  describe('Transmitting', () => {
    it('should start transmitting when connected', async () => {
      const mockSetMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
      const mockRoom = {
        localParticipant: {
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const onTransmittingChange = jest.fn();
      const { result } = renderHook(() => usePTT({ onTransmittingChange }));

      await act(async () => {
        await result.current.startTransmitting();
      });

      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
      expect(result.current.isTransmitting).toBe(true);
    });

    it('should stop transmitting', async () => {
      const mockSetMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
      const mockRoom = {
        localParticipant: {
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const { result } = renderHook(() => usePTT());

      // Start transmitting first
      await act(async () => {
        await result.current.startTransmitting();
      });

      expect(result.current.isTransmitting).toBe(true);

      // Stop transmitting
      await act(async () => {
        await result.current.stopTransmitting();
      });

      expect(mockSetMicrophoneEnabled).toHaveBeenLastCalledWith(false);
      expect(result.current.isTransmitting).toBe(false);
    });

    it('should not transmit when not connected', async () => {
      mockUseLiveKitStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const { result } = renderHook(() => usePTT());

      await act(async () => {
        await result.current.startTransmitting();
      });

      expect(result.current.isTransmitting).toBe(false);
    });
  });

  describe('Mute Toggle', () => {
    it('should toggle mute state', async () => {
      const mockSetMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
      const mockRoom = {
        localParticipant: {
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const { result } = renderHook(() => usePTT());

      expect(result.current.isMuted).toBe(false);

      await act(async () => {
        await result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(true);
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);

      await act(async () => {
        await result.current.toggleMute();
      });

      expect(result.current.isMuted).toBe(false);
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
    });

    it('should set mute state directly', async () => {
      const mockSetMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
      const mockRoom = {
        localParticipant: {
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const { result } = renderHook(() => usePTT());

      await act(async () => {
        await result.current.setMuted(true);
      });

      expect(result.current.isMuted).toBe(true);
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('Callbacks', () => {
    it('should call onConnectionChange when connection state changes', async () => {
      const onConnectionChange = jest.fn();

      // Start disconnected
      mockUseLiveKitStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const { rerender } = renderHook(() => usePTT({ onConnectionChange }));

      expect(onConnectionChange).toHaveBeenCalledWith(false);

      // Simulate connection
      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: { localParticipant: {} },
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      rerender({});

      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it('should call onTransmittingChange when transmitting state changes', async () => {
      const mockSetMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
      const mockRoom = {
        localParticipant: {
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        currentRoom: mockRoom,
        currentRoomInfo: { Id: 'room-1', Name: 'Channel 1' },
        isVoiceEnabled: true,
        voipServerWebsocketSslAddress: 'wss://test.example.com',
        availableRooms: [],
        fetchVoiceSettings: jest.fn().mockResolvedValue(undefined),
        connectToRoom: jest.fn(),
        disconnectFromRoom: jest.fn(),
      });

      const onTransmittingChange = jest.fn();
      const { result } = renderHook(() => usePTT({ onTransmittingChange }));

      await act(async () => {
        await result.current.startTransmitting();
      });

      expect(onTransmittingChange).toHaveBeenCalledWith(true);
    });
  });

  describe('App State Handling', () => {
    it('should set up app state listener on mount', () => {
      const mockRemove = jest.fn();
      const addEventListenerSpy = jest.spyOn(require('react-native').AppState, 'addEventListener').mockReturnValue({ remove: mockRemove });

      renderHook(() => usePTT());

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should clean up app state listener on unmount', () => {
      const mockRemove = jest.fn();
      const addEventListenerSpy = jest.spyOn(require('react-native').AppState, 'addEventListener').mockReturnValue({ remove: mockRemove });

      const { unmount } = renderHook(() => usePTT());

      unmount();

      expect(mockRemove).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });
  });
});
