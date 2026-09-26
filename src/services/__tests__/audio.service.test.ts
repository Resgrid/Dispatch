import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSound = {
  seekTo: jest.fn(),
  play: jest.fn(),
  remove: jest.fn(),
  isLoaded: true,
  loop: false,
  volume: 1,
} as any;

const mockAsset = {
  downloadAsync: jest.fn(),
  localUri: 'mock://local-uri',
  uri: 'mock://uri',
} as any;

// Mock expo-modules-core first to prevent NativeUnimoduleProxy errors
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  requireNativeModule: jest.fn(),
}));

// Mock expo-asset
jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
    fromModule: jest.fn(() => mockAsset),
  },
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(),
  createAudioPlayer: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios),
  },
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock audio files with proper paths
jest.mock('@assets/audio/ui/space_notification1.mp3', () => 'mocked-start-transmitting-sound', { virtual: true });
jest.mock('@assets/audio/ui/space_notification2.mp3', () => 'mocked-stop-transmitting-sound', { virtual: true });
jest.mock('@assets/audio/ui/positive_interface_beep.mp3', () => 'mocked-connected-device-sound', { virtual: true });
jest.mock('@assets/audio/ui/software_interface_start.mp3', () => 'mocked-connect-to-audio-room-sound', { virtual: true });
jest.mock('@assets/audio/ui/software_interface_back.mp3', () => 'mocked-disconnected-from-audio-room-sound', { virtual: true });

import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { logger } from '@/lib/logging';

const mockAssetLoadAsync = Asset.loadAsync as jest.MockedFunction<typeof Asset.loadAsync>;
const mockAssetFromModule = Asset.fromModule as jest.MockedFunction<typeof Asset.fromModule>;
const mockSetAudioModeAsync = setAudioModeAsync as jest.MockedFunction<typeof setAudioModeAsync>;
const mockCreateAudioPlayer = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;

describe('AudioService', () => {
  let audioService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set up mocks with proper return values BEFORE importing the service
    mockAssetLoadAsync.mockResolvedValue([] as any);
    mockAssetFromModule.mockReturnValue(mockAsset);
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    (mockCreateAudioPlayer as jest.MockedFunction<any>).mockReturnValue(mockSound);
    mockAsset.downloadAsync.mockResolvedValue(undefined);
    mockSound.seekTo.mockResolvedValue(undefined);
    mockSound.play.mockReturnValue(undefined);
    mockSound.remove.mockReturnValue(undefined);

    // Clear the module cache to ensure fresh imports
    delete require.cache[require.resolve('../audio.service')];

    // Import the service after setting up mocks
    const AudioServiceModule = require('../audio.service');
    audioService = AudioServiceModule.audioService;

    // Reset the initialization flag and manually trigger initialization to ensure it runs with our mocks
    (audioService as any).isInitialized = false;
    await audioService.initialize();
  });

  describe('initialization', () => {
    it('should initialize audio service successfully', async () => {
      expect(logger.info).toHaveBeenCalledWith({
        message: 'Audio service initialized successfully',
      });
    });

    it('should set audio mode correctly', () => {
      expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: true,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: true,
        interruptionMode: 'doNotMix',
      });
    });

    it('should preload all audio assets', () => {
      expect(mockAssetLoadAsync).toHaveBeenCalledTimes(5);
    });

    it('should load all audio files', () => {
      expect(mockAssetFromModule).toHaveBeenCalledTimes(5);
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(5);
      expect(mockCreateAudioPlayer).toHaveBeenCalledWith({ uri: 'mock://local-uri' }, { keepAudioSessionActive: true });
    });
  });

  describe('playStartTransmittingSound', () => {
    it('should play start transmitting sound successfully', async () => {
      jest.clearAllMocks();

      await audioService.playStartTransmittingSound();

      expect(mockSound.seekTo).toHaveBeenCalledWith(0);
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should handle start transmitting sound playback errors', async () => {
      jest.clearAllMocks();
      mockSound.play.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playStartTransmittingSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'startTransmitting', error: expect.any(Error) },
      });
    });
  });

  describe('playStopTransmittingSound', () => {
    it('should play stop transmitting sound successfully', async () => {
      jest.clearAllMocks();

      await audioService.playStopTransmittingSound();

      expect(mockSound.seekTo).toHaveBeenCalledWith(0);
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should handle stop transmitting sound playback errors', async () => {
      jest.clearAllMocks();
      mockSound.play.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playStopTransmittingSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'stopTransmitting', error: expect.any(Error) },
      });
    });
  });

  describe('playConnectedDeviceSound', () => {
    it('should play connected device sound successfully', async () => {
      jest.clearAllMocks();

      await audioService.playConnectedDeviceSound();

      expect(mockSound.seekTo).toHaveBeenCalledWith(0);
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should handle connected device sound playback errors', async () => {
      jest.clearAllMocks();
      mockSound.play.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playConnectedDeviceSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'connectedDevice', error: expect.any(Error) },
      });
    });
  });

  describe('playConnectToAudioRoomSound', () => {
    it('should play connect to audio room sound successfully', async () => {
      jest.clearAllMocks();

      await audioService.playConnectToAudioRoomSound();

      expect(mockSound.seekTo).toHaveBeenCalledWith(0);
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should handle connect to audio room sound playback errors', async () => {
      jest.clearAllMocks();
      mockSound.play.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playConnectToAudioRoomSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'connectedToAudioRoom', error: expect.any(Error) },
      });
    });
  });

  describe('playDisconnectedFromAudioRoomSound', () => {
    it('should play disconnected from audio room sound successfully', async () => {
      jest.clearAllMocks();

      await audioService.playDisconnectedFromAudioRoomSound();

      expect(mockSound.seekTo).toHaveBeenCalledWith(0);
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should handle disconnected from audio room sound playback errors', async () => {
      jest.clearAllMocks();
      mockSound.play.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playDisconnectedFromAudioRoomSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'disconnectedFromAudioRoom', error: expect.any(Error) },
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup audio resources successfully', async () => {
      jest.clearAllMocks();

      await audioService.cleanup();

      expect(mockSound.remove).toHaveBeenCalledTimes(5);
      expect(logger.info).toHaveBeenCalledWith({
        message: 'Audio service cleaned up',
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      // Set up a fresh service instance for this test
      jest.clearAllMocks();
      mockSound.remove.mockImplementationOnce(() => {
        throw new Error('Unload failed');
      });

      // Clear module cache and re-import to get fresh instance
      delete require.cache[require.resolve('../audio.service')];
      const AudioServiceModule = require('../audio.service');
      const testService = AudioServiceModule.audioService;
      (testService as any).isInitialized = false;
      await testService.initialize();

      await testService.cleanup();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Error during audio service cleanup',
        context: { error: expect.any(Error) },
      });
    });
  });

  describe('error handling', () => {
    it('should handle null sound objects gracefully', async () => {
      // Create a new service instance whose players fail to be created
      jest.clearAllMocks();
      delete require.cache[require.resolve('../audio.service')];

      // Make createAudioPlayer throw to simulate failed sound creation
      mockCreateAudioPlayer.mockImplementation(() => {
        throw new Error('Player creation failed');
      });

      const AudioServiceModule = require('../audio.service');
      const testService = AudioServiceModule.audioService;

      // Release the players from the previous initialization so re-initialization has to recreate them
      await testService.cleanup();
      await testService.initialize();
      await testService.playStartTransmittingSound();

      expect(logger.warn).toHaveBeenCalledWith({
        message: 'Sound not loaded: startTransmitting',
      });
    });

    it('should handle initialization failures', async () => {
      jest.clearAllMocks();
      mockSetAudioModeAsync.mockRejectedValueOnce(new Error('Audio mode failed'));

      // Re-import to trigger new initialization
      delete require.cache[require.resolve('../audio.service')];
      const AudioServiceModule = require('../audio.service');
      const testService = AudioServiceModule.audioService;

      (testService as any).isInitialized = false;
      await testService.initialize();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to initialize audio service',
        context: { error: expect.any(Error) },
      });
    });
  });
});
