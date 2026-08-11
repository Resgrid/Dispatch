import { create } from 'zustand';

import { getDepartmentAudioStreams } from '@/api/voice';
import { logger } from '@/lib/logging';
import { type DepartmentAudioResultStreamData } from '@/models/v4/voice/departmentAudioResultStreamData';

// Aborts all listeners on the current audio element; recreated per stream so
// stopStream can actually detach handlers instead of leaving them for the GC.
let streamListenersAbort: AbortController | null = null;

const detachStreamListeners = () => {
  if (streamListenersAbort) {
    streamListenersAbort.abort();
    streamListenersAbort = null;
  }
};

interface AudioStreamState {
  // Available streams
  availableStreams: DepartmentAudioResultStreamData[];
  isLoadingStreams: boolean;

  // Current stream
  currentStream: DepartmentAudioResultStreamData | null;
  audioElement: HTMLAudioElement | null;
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
  audioElement: null,
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
      const { audioElement: currentAudio, stopStream } = get();

      // Stop current stream if playing
      if (currentAudio) {
        await stopStream();
      }

      set({ isLoading: true, isBuffering: true });

      logger.debug({
        message: 'Starting audio stream (web)',
        context: { streamName: stream.Name, streamUrl: stream.Url },
      });

      // Create HTML audio element for web
      const audio = new Audio(stream.Url);
      audio.crossOrigin = 'anonymous';

      // Listeners are attached with an AbortSignal so stopStream can detach them;
      // otherwise each play/stop cycle stacks another set of closures on the element
      detachStreamListeners();
      streamListenersAbort = new AbortController();
      const listenerSignal = streamListenersAbort.signal;

      // Set up event listeners
      audio.addEventListener(
        'loadeddata',
        () => {
          set({ isLoading: false, isBuffering: false });
          logger.debug({
            message: 'Audio stream loaded',
            context: { streamName: stream.Name },
          });
        },
        { signal: listenerSignal }
      );

      audio.addEventListener(
        'playing',
        () => {
          set({ isPlaying: true, isBuffering: false });
          logger.debug({
            message: 'Audio stream playing',
            context: { streamName: stream.Name },
          });
        },
        { signal: listenerSignal }
      );

      audio.addEventListener(
        'pause',
        () => {
          set({ isPlaying: false });
          logger.debug({
            message: 'Audio stream paused',
            context: { streamName: stream.Name },
          });
        },
        { signal: listenerSignal }
      );

      audio.addEventListener(
        'waiting',
        () => {
          set({ isBuffering: true });
          logger.debug({
            message: 'Audio stream buffering',
            context: { streamName: stream.Name },
          });
        },
        { signal: listenerSignal }
      );

      audio.addEventListener(
        'error',
        (e) => {
          logger.error({
            message: 'Audio stream error',
            context: { error: e, streamName: stream.Name },
          });
          set({ isPlaying: false, isLoading: false, isBuffering: false });
        },
        { signal: listenerSignal }
      );

      audio.addEventListener(
        'ended',
        () => {
          logger.debug({
            message: 'Audio stream ended',
            context: { streamName: stream.Name },
          });
          set({ isPlaying: false });
        },
        { signal: listenerSignal }
      );

      // Start playing
      await audio.play();

      set({
        currentStream: stream,
        audioElement: audio,
        isPlaying: true,
        isLoading: false,
      });

      logger.info({
        message: 'Audio stream started successfully (web)',
        context: { streamName: stream.Name },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play audio stream (web)',
        context: { error },
      });
      set({ isPlaying: false, isLoading: false, isBuffering: false });
      throw error;
    }
  },

  stopStream: async () => {
    try {
      const { audioElement, currentStream } = get();

      if (audioElement) {
        detachStreamListeners();
        audioElement.pause();
        audioElement.src = '';
        audioElement.load();

        logger.debug({
          message: 'Audio stream stopped (web)',
          context: { streamName: currentStream?.Name },
        });
      }

      set({
        audioElement: null,
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to stop audio stream (web)',
        context: { error },
      });
    }
  },

  cleanup: async () => {
    try {
      await get().stopStream();

      logger.info({
        message: 'Audio stream store cleaned up (web)',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to cleanup audio stream store (web)',
        context: { error },
      });
    }
  },
}));
