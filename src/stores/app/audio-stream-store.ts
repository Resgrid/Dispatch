import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getDepartmentAudioStreams } from '@/api/voice';
import { logger } from '@/lib/logging';
import { type DepartmentAudioResultStreamData } from '@/models/v4/voice/departmentAudioResultStreamData';

// Tracks the pending stream-restart timeout so it can be cancelled when playback stops
let replayTimeout: ReturnType<typeof setTimeout> | null = null;

const clearReplayTimeout = () => {
  if (replayTimeout) {
    clearTimeout(replayTimeout);
    replayTimeout = null;
  }
};

interface AudioStreamState {
  // Available streams
  availableStreams: DepartmentAudioResultStreamData[];
  isLoadingStreams: boolean;

  // Current stream
  currentStream: DepartmentAudioResultStreamData | null;
  soundObject: AudioPlayer | null;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;

  // UI state
  isBottomSheetVisible: boolean;

  // Actions
  setAvailableStreams: (streams: DepartmentAudioResultStreamData[]) => void;
  setIsLoadingStreams: (loading: boolean) => void;
  setCurrentStream: (stream: DepartmentAudioResultStreamData | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setIsBottomSheetVisible: (visible: boolean) => void;

  // Stream operations
  fetchAvailableStreams: () => Promise<void>;
  playStream: (stream: DepartmentAudioResultStreamData) => Promise<void>;
  stopStream: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useAudioStreamStore = create<AudioStreamState>((set, get) => ({
  availableStreams: [],
  isLoadingStreams: false,
  currentStream: null,
  soundObject: null,
  isPlaying: false,
  isLoading: false,
  isBuffering: false,
  isBottomSheetVisible: false,

  setAvailableStreams: (streams) => set({ availableStreams: streams }),
  setIsLoadingStreams: (loading) => set({ isLoadingStreams: loading }),
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  setIsBottomSheetVisible: (visible) => set({ isBottomSheetVisible: visible }),

  fetchAvailableStreams: async () => {
    try {
      set({ isLoadingStreams: true });
      const response = await getDepartmentAudioStreams();
      set({ availableStreams: response.Data || [] });

      logger.debug({
        message: 'Audio streams fetched successfully',
        context: { count: response.Data?.length || 0 },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch audio streams',
        context: { error },
      });
      set({ availableStreams: [] });
    } finally {
      set({ isLoadingStreams: false });
    }
  },

  playStream: async (stream: DepartmentAudioResultStreamData) => {
    try {
      const { soundObject: currentSound, stopStream } = get();

      // Stop current stream if playing
      if (currentSound) {
        await stopStream();
      }

      set({ isLoading: true, isBuffering: true });

      logger.debug({
        message: 'Starting audio stream',
        context: { streamName: stream.Name, streamUrl: stream.Url },
      });

      // Configure audio mode for streaming
      await setAudioModeAsync({
        allowsRecording: false,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: Platform.OS === 'android' ? 'duckOthers' : 'mixWithOthers',
      });

      // Create new player
      const source = { uri: stream.Url };
      const sound = createAudioPlayer(source, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
      });
      sound.loop = false;
      sound.volume = 1.0;
      sound.muted = false;

      // Active before any status can arrive, so the listener can tell this player's events from a superseded one's.
      set({ soundObject: sound, currentStream: stream });

      sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        // A stopped or replaced player can still emit a late status; only the active player may touch the state.
        if (get().soundObject !== sound) {
          return;
        }

        if (status.error) {
          // Handle error state
          logger.error({
            message: 'Audio playback error',
            context: { error: status.error, streamName: stream.Name },
          });
          try {
            sound.remove();
          } catch {
            // The player may already have been released.
          }
          set({
            soundObject: null,
            currentStream: null,
            isPlaying: false,
            isLoading: false,
            isBuffering: false,
          });
          return;
        }

        const { isPlaying, isBuffering } = get();

        if (status.playing !== isPlaying) {
          set({ isPlaying: status.playing });
        }

        if (status.isBuffering !== isBuffering) {
          set({ isBuffering: status.isBuffering });
        }

        // Handle stream ended scenarios
        if (status.didJustFinish) {
          logger.info({
            message: 'Audio stream finished',
            context: { streamName: stream.Name },
          });

          // For live streams, try to reconnect
          const { currentStream } = get();
          if (currentStream?.Id === stream.Id) {
            clearReplayTimeout();
            replayTimeout = setTimeout(() => {
              replayTimeout = null;
              try {
                // Re-point the player at the source rather than seeking: a live stream has
                // nothing buffered to seek back into, so only a fresh connection resumes it.
                sound.replace(source);
                sound.play();
              } catch (replayError) {
                logger.error({
                  message: 'Failed to restart audio stream',
                  context: { error: replayError, streamName: stream.Name },
                });
              }
            }, 1000);
          }
        }
      });

      // Start playing
      sound.play();

      // An error status reported while starting has already released this player.
      if (get().soundObject !== sound) {
        return;
      }

      logger.info({
        message: 'Audio stream started successfully',
        context: { streamName: stream.Name },
      });

      set({
        isPlaying: true,
        isLoading: false,
        isBuffering: false,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play audio stream',
        context: { error, streamName: stream.Name },
      });

      set({
        soundObject: null,
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
      });
    }
  },

  stopStream: async () => {
    try {
      clearReplayTimeout();

      const { soundObject, currentStream } = get();

      if (soundObject) {
        soundObject.pause();
        soundObject.remove();

        logger.info({
          message: 'Audio stream stopped',
          context: { streamName: currentStream?.Name },
        });
      }

      set({
        soundObject: null,
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to stop audio stream',
        context: { error },
      });
    }
  },

  cleanup: async () => {
    try {
      const { stopStream } = get();
      await stopStream();

      logger.debug({
        message: 'Audio stream store cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to cleanup audio stream store',
        context: { error },
      });
    }
  },
}));
