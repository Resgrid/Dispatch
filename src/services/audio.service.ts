import { Asset } from 'expo-asset';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { logger } from '@/lib/logging';

class AudioService {
  private static instance: AudioService;
  private startTransmittingSound: AudioPlayer | null = null;
  private stopTransmittingSound: AudioPlayer | null = null;
  private connectedDeviceSound: AudioPlayer | null = null;
  private connectToAudioRoomSound: AudioPlayer | null = null;
  private disconnectedFromAudioRoomSound: AudioPlayer | null = null;
  private isInitialized = false;

  private constructor() {
    this.initializeAudio();
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public async initialize(): Promise<void> {
    await this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure audio mode for production builds
      await setAudioModeAsync({
        allowsRecording: true,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: true,
        interruptionMode: Platform.OS === 'android' ? 'duckOthers' : 'doNotMix',
      });

      // Pre-load audio assets for production builds
      await this.preloadAudioAssets();

      // Load audio files
      await this.loadAudioFiles();

      this.isInitialized = true;

      logger.info({
        message: 'Audio service initialized successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize audio service',
        context: { error },
      });
    }
  }

  public async preloadAudioAssets(): Promise<void> {
    try {
      await Promise.all([
        Asset.loadAsync(require('@assets/audio/ui/space_notification1.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/space_notification2.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/positive_interface_beep.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/software_interface_start.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/software_interface_back.mp3')),
      ]);

      logger.debug({
        message: 'Audio assets preloaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Error preloading audio assets',
        context: { error },
      });
    }
  }

  private async loadAudioFiles(): Promise<void> {
    try {
      // Load start transmitting sound
      const startTransmittingSoundAsset = Asset.fromModule(require('@assets/audio/ui/space_notification1.mp3'));
      await startTransmittingSoundAsset.downloadAsync();

      const startSound = createAudioPlayer({ uri: startTransmittingSoundAsset.localUri || startTransmittingSoundAsset.uri }, { keepAudioSessionActive: true });
      startSound.loop = false;
      startSound.volume = 1.0;
      this.startTransmittingSound = startSound;

      // Load stop transmitting sound
      const stopTransmittingSoundAsset = Asset.fromModule(require('@assets/audio/ui/space_notification2.mp3'));
      await stopTransmittingSoundAsset.downloadAsync();

      const stopSound = createAudioPlayer({ uri: stopTransmittingSoundAsset.localUri || stopTransmittingSoundAsset.uri }, { keepAudioSessionActive: true });
      stopSound.loop = false;
      stopSound.volume = 1.0;
      this.stopTransmittingSound = stopSound;

      // Load connected device sound
      const connectedDeviceSoundAsset = Asset.fromModule(require('@assets/audio/ui/positive_interface_beep.mp3'));
      await connectedDeviceSoundAsset.downloadAsync();

      const connectedSound = createAudioPlayer({ uri: connectedDeviceSoundAsset.localUri || connectedDeviceSoundAsset.uri }, { keepAudioSessionActive: true });
      connectedSound.loop = false;
      connectedSound.volume = 1.0;
      this.connectedDeviceSound = connectedSound;

      // Load connect to audio room sound
      const connectToAudioRoomSoundAsset = Asset.fromModule(require('@assets/audio/ui/software_interface_start.mp3'));
      await connectToAudioRoomSoundAsset.downloadAsync();

      const connectToRoomSound = createAudioPlayer({ uri: connectToAudioRoomSoundAsset.localUri || connectToAudioRoomSoundAsset.uri }, { keepAudioSessionActive: true });
      connectToRoomSound.loop = false;
      connectToRoomSound.volume = 1.0;
      this.connectToAudioRoomSound = connectToRoomSound;

      // Load disconnect from audio room sound
      const disconnectedFromAudioRoomSoundAsset = Asset.fromModule(require('@assets/audio/ui/software_interface_back.mp3'));
      await disconnectedFromAudioRoomSoundAsset.downloadAsync();

      const disconnectFromRoomSound = createAudioPlayer({ uri: disconnectedFromAudioRoomSoundAsset.localUri || disconnectedFromAudioRoomSoundAsset.uri }, { keepAudioSessionActive: true });
      disconnectFromRoomSound.loop = false;
      disconnectFromRoomSound.volume = 1.0;
      this.disconnectedFromAudioRoomSound = disconnectFromRoomSound;

      logger.debug({
        message: 'Audio files loaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to load audio files',
        context: { error },
      });
    }
  }

  private async playSound(sound: AudioPlayer | null, soundName: string): Promise<void> {
    try {
      if (!sound) {
        logger.warn({
          message: `Sound not loaded: ${soundName}`,
        });
        return;
      }

      // Ensure audio service is initialized
      if (!this.isInitialized) {
        await this.initializeAudio();
      }

      // Reset to start and play
      if (sound.isLoaded) {
        await sound.seekTo(0);
      }
      sound.play();

      logger.debug({
        message: 'Sound played successfully',
        context: { soundName },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play sound',
        context: { soundName, error },
      });
    }
  }

  async playStartTransmittingSound(): Promise<void> {
    try {
      await this.playSound(this.startTransmittingSound, 'startTransmitting');
    } catch (error) {
      logger.error({
        message: 'Failed to play start transmitting sound',
        context: { error },
      });
    }
  }

  async playStopTransmittingSound(): Promise<void> {
    try {
      await this.playSound(this.stopTransmittingSound, 'stopTransmitting');
    } catch (error) {
      logger.error({
        message: 'Failed to play stop transmitting sound',
        context: { error },
      });
    }
  }

  async playConnectedDeviceSound(): Promise<void> {
    try {
      await this.playSound(this.connectedDeviceSound, 'connectedDevice');
    } catch (error) {
      logger.error({
        message: 'Failed to play connected device sound',
        context: { error },
      });
    }
  }

  async playConnectToAudioRoomSound(): Promise<void> {
    try {
      await this.playSound(this.connectToAudioRoomSound, 'connectedToAudioRoom');
    } catch (error) {
      logger.error({
        message: 'Failed to play connected to audio room sound',
        context: { error },
      });
    }
  }

  async playDisconnectedFromAudioRoomSound(): Promise<void> {
    try {
      await this.playSound(this.disconnectedFromAudioRoomSound, 'disconnectedFromAudioRoom');
    } catch (error) {
      logger.error({
        message: 'Failed to play disconnected from audio room sound',
        context: { error },
      });
    }
  }

  /**
   * Play a notification sound based on the notification type
   * Uses the positive interface beep for general notifications
   */
  async playNotificationSound(notificationType?: 'call' | 'message' | 'chat' | 'group-chat' | 'unknown'): Promise<void> {
    try {
      // For now, use the connected device sound (positive beep) for all notifications
      // In the future, you could load different sounds for different notification types
      await this.playSound(this.connectedDeviceSound, `notification-${notificationType || 'default'}`);

      logger.debug({
        message: 'Notification sound played',
        context: { notificationType },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play notification sound',
        context: { error, notificationType },
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Unload start transmitting sound
      if (this.startTransmittingSound) {
        this.startTransmittingSound.remove();
        this.startTransmittingSound = null;
      }

      // Unload stop transmitting sound
      if (this.stopTransmittingSound) {
        this.stopTransmittingSound.remove();
        this.stopTransmittingSound = null;
      }

      // Unload connected device sound
      if (this.connectedDeviceSound) {
        this.connectedDeviceSound.remove();
        this.connectedDeviceSound = null;
      }

      // Unload connect to audio room sound
      if (this.connectToAudioRoomSound) {
        this.connectToAudioRoomSound.remove();
        this.connectToAudioRoomSound = null;
      }

      // Unload disconnect from audio room sound
      if (this.disconnectedFromAudioRoomSound) {
        this.disconnectedFromAudioRoomSound.remove();
        this.disconnectedFromAudioRoomSound = null;
      }

      this.isInitialized = false;

      logger.info({
        message: 'Audio service cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Error during audio service cleanup',
        context: { error },
      });
    }
  }
}

export const audioService = AudioService.getInstance();
