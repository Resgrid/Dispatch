import { setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { logger } from '@/lib/logging';
import { type DepartmentVoiceChannelResultData } from '@/models/v4/voice/departmentVoiceResultData';
import { audioService } from '@/services/audio.service';
import { useLiveKitStore } from '@/stores/app/livekit-store';

// Platform-specific imports for iOS CallKeep
let callKeepService: any = null;
if (Platform.OS === 'ios') {
  try {
    callKeepService = require('@/services/callkeep.service.ios').callKeepService;
  } catch {
    logger.warn({ message: 'CallKeep service not available on iOS' });
  }
}

export interface UsePTTOptions {
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
  onTransmittingChange?: (transmitting: boolean) => void;
}

export interface UsePTTReturn {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  isTransmitting: boolean;
  isMuted: boolean;
  currentChannel: DepartmentVoiceChannelResultData | null;
  availableChannels: DepartmentVoiceChannelResultData[];
  isVoiceEnabled: boolean;
  error: string | null;

  // Actions
  connect: (channel?: DepartmentVoiceChannelResultData) => Promise<void>;
  disconnect: () => Promise<void>;
  startTransmitting: () => Promise<void>;
  stopTransmitting: () => Promise<void>;
  toggleMute: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  selectChannel: (channel: DepartmentVoiceChannelResultData) => void;
  refreshVoiceSettings: () => Promise<void>;
}

/**
 * Custom hook for Push-To-Talk functionality using LiveKit
 * Handles voice room connections, microphone control, and platform-specific audio routing
 */
export function usePTT(options: UsePTTOptions = {}): UsePTTReturn {
  const { onConnectionChange, onError, onTransmittingChange } = options;

  // LiveKit store state
  const {
    isConnected: storeConnected,
    isConnecting: storeConnecting,
    currentRoom,
    currentRoomInfo,
    isVoiceEnabled,
    voipServerWebsocketSslAddress,
    availableRooms,
    fetchVoiceSettings,
    connectToRoom,
    disconnectFromRoom,
  } = useLiveKitStore();

  // Local state
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<DepartmentVoiceChannelResultData | null>(null);

  // Refs for tracking app state and channel for reconnection
  const appState = useRef(AppState.currentState);
  const wasConnectedBeforeBackground = useRef(false);
  const selectedChannelRef = useRef<DepartmentVoiceChannelResultData | null>(null);

  // Refs for callbacks to prevent effect re-runs when callback references change
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);
  const onTransmittingChangeRef = useRef(onTransmittingChange);

  // Keep ref in sync with state
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  // Keep callback refs in sync with latest options
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onTransmittingChangeRef.current = onTransmittingChange;
  }, [onTransmittingChange]);

  // Handle connection state changes - use ref to avoid infinite loops
  useEffect(() => {
    onConnectionChangeRef.current?.(storeConnected);
  }, [storeConnected]);

  // Handle transmitting state changes - use ref to avoid infinite loops
  useEffect(() => {
    onTransmittingChangeRef.current?.(isTransmitting);
  }, [isTransmitting]);

  // Handle app state changes for iOS background audio
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground
        logger.debug({ message: 'PTT: App came to foreground' });

        // Note: Reconnection would need to be handled manually by the user
        // as automatic reconnection may cause issues with CallKeep/foreground service
        if (wasConnectedBeforeBackground.current && !storeConnected) {
          logger.info({ message: 'PTT: Was connected before background, may need reconnection' });
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App is going to background
        logger.debug({ message: 'PTT: App going to background' });
        wasConnectedBeforeBackground.current = storeConnected;

        // On iOS, keep connection alive via CallKeep
        // On Android, keep connection alive via foreground service (handled in livekit-store)
        // On Web, connections persist naturally
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [storeConnected]);

  // Initialize voice settings on mount
  useEffect(() => {
    refreshVoiceSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshVoiceSettings depends on fetchVoiceSettings from Zustand store which is stable
  }, []);

  /**
   * Configure audio mode for PTT usage
   */
  const configureAudioMode = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web doesn't need audio mode configuration
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: Platform.OS === 'android' ? 'duckOthers' : 'mixWithOthers',
      });

      logger.debug({ message: 'PTT: Audio mode configured successfully' });
    } catch (err) {
      logger.error({
        message: 'PTT: Failed to configure audio mode',
        context: { error: err },
      });
    }
  }, []);

  /**
   * Internal mute state setter that also controls LiveKit microphone
   */
  const setMutedInternal = useCallback(
    async (muted: boolean) => {
      setIsMuted(muted);

      if (currentRoom?.localParticipant) {
        try {
          await currentRoom.localParticipant.setMicrophoneEnabled(!muted);
          logger.debug({
            message: 'PTT: Microphone state changed',
            context: { muted },
          });
        } catch (err) {
          logger.error({
            message: 'PTT: Failed to set microphone state',
            context: { error: err },
          });
        }
      }
    },
    [currentRoom]
  );

  /**
   * Start iOS CallKeep session for background audio
   */
  const startCallKeepSession = useCallback(
    async (channelName: string) => {
      if (Platform.OS !== 'ios' || !callKeepService) return;

      try {
        const callUUID = await callKeepService.startCall(channelName);
        logger.info({
          message: 'PTT: CallKeep session started',
          context: { callUUID, channelName },
        });

        // Set up mute callback - sync both UI state and LiveKit microphone
        callKeepService.setMuteStateCallback(async (muted: boolean) => {
          await setMutedInternal(muted);
        });
      } catch (err) {
        logger.warn({
          message: 'PTT: Failed to start CallKeep session',
          context: { error: err },
        });
      }
    },
    [setMutedInternal]
  );

  /**
   * End iOS CallKeep session
   */
  const endCallKeepSession = useCallback(async () => {
    if (Platform.OS !== 'ios' || !callKeepService) return;

    try {
      await callKeepService.endCall();
      callKeepService.setMuteStateCallback(null);
      logger.info({ message: 'PTT: CallKeep session ended' });
    } catch (err) {
      logger.warn({
        message: 'PTT: Failed to end CallKeep session',
        context: { error: err },
      });
    }
  }, []);

  /**
   * Refresh voice settings from the server
   */
  const refreshVoiceSettings = useCallback(async () => {
    try {
      await fetchVoiceSettings();
      setError(null);
      logger.info({ message: 'PTT: Voice settings refreshed' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch voice settings';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      logger.error({
        message: 'PTT: Failed to refresh voice settings',
        context: { error: err },
      });
    }
  }, [fetchVoiceSettings]);

  /**
   * Connect to a voice channel
   */
  const connect = useCallback(
    async (channel?: DepartmentVoiceChannelResultData) => {
      const targetChannel = channel || selectedChannel;

      if (!targetChannel) {
        const errorMsg = 'No channel selected';
        setError(errorMsg);
        onErrorRef.current?.(errorMsg);
        return;
      }

      if (!isVoiceEnabled) {
        const errorMsg = 'Voice is not enabled for this department';
        setError(errorMsg);
        onErrorRef.current?.(errorMsg);
        return;
      }

      if (storeConnecting || storeConnected) {
        logger.warn({ message: 'PTT: Already connecting or connected' });
        return;
      }

      setError(null);

      try {
        // Configure audio mode for the platform
        await configureAudioMode();

        // Get connection token
        logger.info({
          message: 'PTT: Connecting to channel',
          context: { channelId: targetChannel.Id, channelName: targetChannel.Name },
        });

        // Connect using the channel's token
        await connectToRoom(targetChannel, targetChannel.Token);

        // Start platform-specific background audio support
        if (Platform.OS === 'ios') {
          await startCallKeepSession(targetChannel.Name);
        }

        setSelectedChannel(targetChannel);

        logger.info({
          message: 'PTT: Connected to channel',
          context: { channelName: targetChannel.Name },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
        setError(errorMsg);
        onErrorRef.current?.(errorMsg);
        logger.error({
          message: 'PTT: Connection failed',
          context: { error: err, channelId: targetChannel.Id },
        });
      }
    },
    [selectedChannel, isVoiceEnabled, storeConnecting, storeConnected, configureAudioMode, connectToRoom, startCallKeepSession]
  );

  /**
   * Disconnect from the current voice channel
   */
  const disconnect = useCallback(async () => {
    try {
      logger.info({ message: 'PTT: Disconnecting from channel' });

      // Stop transmitting if we are - inline implementation to avoid circular dependency
      if (currentRoom?.localParticipant) {
        try {
          await currentRoom.localParticipant.setMicrophoneEnabled(false);
        } catch (err) {
          logger.warn({
            message: 'PTT: Failed to disable microphone during disconnect',
            context: { error: err },
          });
        }
      }

      // Disconnect from LiveKit room
      await disconnectFromRoom();

      // End platform-specific background audio support
      if (Platform.OS === 'ios') {
        await endCallKeepSession();
      }

      setIsTransmitting(false);
      setIsMuted(false);
      setError(null);

      logger.info({ message: 'PTT: Disconnected from channel' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      logger.error({
        message: 'PTT: Disconnect failed',
        context: { error: err },
      });
    }
  }, [currentRoom, disconnectFromRoom, endCallKeepSession]);

  /**
   * Start transmitting (unmute and enable PTT)
   */
  const startTransmitting = useCallback(async () => {
    if (!storeConnected || !currentRoom?.localParticipant) {
      logger.warn({ message: 'PTT: Cannot transmit - not connected' });
      return;
    }

    try {
      // Enable microphone
      await currentRoom.localParticipant.setMicrophoneEnabled(true);
      setIsTransmitting(true);
      setIsMuted(false);

      // Play PTT start sound
      try {
        await audioService.playStartTransmittingSound();
      } catch (sfxErr) {
        logger.warn({
          message: 'PTT: Failed to play start transmitting sound',
          context: { error: sfxErr },
        });
      }

      logger.debug({ message: 'PTT: Started transmitting' });
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Failed to start transmitting';

      // Provide more helpful error messages for common issues
      if (errorMsg.includes('Requested device not found') || errorMsg.includes('NotFoundError')) {
        errorMsg = 'No microphone found. Please check your audio device settings.';
      } else if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
        errorMsg = 'Microphone permission denied. Please allow microphone access.';
      }

      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      logger.error({
        message: 'PTT: Failed to start transmitting',
        context: { error: err },
      });
    }
  }, [storeConnected, currentRoom]);

  /**
   * Stop transmitting (mute and disable PTT)
   */
  const stopTransmitting = useCallback(async () => {
    if (!currentRoom?.localParticipant) {
      setIsTransmitting(false);
      return;
    }

    try {
      // Disable microphone
      await currentRoom.localParticipant.setMicrophoneEnabled(false);
      setIsTransmitting(false);

      // Play PTT stop sound
      try {
        await audioService.playStopTransmittingSound();
      } catch (sfxErr) {
        logger.warn({
          message: 'PTT: Failed to play stop transmitting sound',
          context: { error: sfxErr },
        });
      }

      logger.debug({ message: 'PTT: Stopped transmitting' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop transmitting';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
      logger.error({
        message: 'PTT: Failed to stop transmitting',
        context: { error: err },
      });
    }
  }, [currentRoom]);

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(async () => {
    await setMutedInternal(!isMuted);
  }, [isMuted, setMutedInternal]);

  /**
   * Set mute state
   */
  const setMuted = useCallback(
    async (muted: boolean) => {
      await setMutedInternal(muted);
    },
    [setMutedInternal]
  );

  /**
   * Select a channel (does not connect automatically)
   */
  const selectChannel = useCallback((channel: DepartmentVoiceChannelResultData) => {
    setSelectedChannel(channel);
    logger.debug({
      message: 'PTT: Channel selected',
      context: { channelId: channel.Id, channelName: channel.Name },
    });
  }, []);

  return {
    // State
    isConnected: storeConnected,
    isConnecting: storeConnecting,
    isTransmitting,
    isMuted,
    currentChannel: currentRoomInfo || selectedChannel,
    availableChannels: availableRooms,
    isVoiceEnabled,
    error,

    // Actions
    connect,
    disconnect,
    startTransmitting,
    stopTransmitting,
    toggleMute,
    setMuted,
    selectChannel,
    refreshVoiceSettings,
  };
}
