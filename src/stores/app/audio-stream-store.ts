import { Audio, type AVPlaybackSource, type AVPlaybackStatus } from 'expo-av';
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
  soundObject: Audio.Sound | null;
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create new sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: stream.Url } as AVPlaybackSource,
        {
          shouldPlay: false,
          isLooping: false,
          volume: 1.0,
          isMuted: false,
          progressUpdateIntervalMillis: 1000,
        },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            const { isPlaying, isBuffering } = get();

            if (status.isPlaying !== isPlaying) {
              set({ isPlaying: status.isPlaying });
            }

            if (status.isBuffering !== isBuffering) {
              set({ isBuffering: status.isBuffering });
            }

            // Handle stream ended/error scenarios
            if (status.didJustFinish) {
              logger.info({
                message: 'Audio stream finished',
                context: { streamName: stream.Name },
              });

              // For live streams, try to reconnect
              const { currentStream } = get();
              if (currentStream?.Id === stream.Id) {
                clearReplayTimeout();
                replayTimeout = setTimeout(async () => {
                  replayTimeout = null;
                  try {
                    await sound.replayAsync();
                  } catch (replayError) {
                    logger.error({
                      message: 'Failed to restart audio stream',
                      context: { error: replayError, streamName: stream.Name },
                    });
                  }
                }, 1000);
              }
            }
          } else {
            // Handle error state
            logger.error({
              message: 'Audio playback error',
              context: { error: 'Failed to load audio', streamName: stream.Name },
            });
            set({
              soundObject: null,
              currentStream: null,
              isPlaying: false,
              isLoading: false,
              isBuffering: false,
            });
          }
        }
      );

      // Start playing
      await sound.playAsync();

      logger.info({
        message: 'Audio stream started successfully',
        context: { streamName: stream.Name },
      });

      set({
        soundObject: sound,
        currentStream: stream,
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
        await soundObject.pauseAsync();
        await soundObject.unloadAsync();

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
