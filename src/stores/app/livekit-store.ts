import type notifeeType from '@notifee/react-native';
import type { AndroidImportance as AndroidImportanceType } from '@notifee/react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Platform } from 'react-native';
import { create } from 'zustand';

// Notifee is native-only - conditionally require it so web module evaluation doesn't crash
let notifee: typeof notifeeType | null = null;
let AndroidImportance: typeof AndroidImportanceType | null = null;

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  notifee = require('@notifee/react-native').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AndroidImportance = require('@notifee/react-native').AndroidImportance;
}

import { getCanConnectToVoiceSession, getDepartmentVoiceSettings } from '../../api/voice';
import { logger } from '../../lib/logging';
import { type DepartmentVoiceChannelResultData } from '../../models/v4/voice/departmentVoiceResultData';
import { audioService } from '../../services/audio.service';
import { useBluetoothAudioStore } from './bluetooth-audio-store';

// Helper function to setup audio routing based on selected devices
const setupAudioRouting = async (room: Room): Promise<void> => {
  try {
    const bluetoothStore = useBluetoothAudioStore.getState();
    const { selectedAudioDevices, connectedDevice } = bluetoothStore;

    // If we have a connected Bluetooth device, prioritize it
    if (connectedDevice && connectedDevice.hasAudioCapability) {
      logger.info({
        message: 'Using Bluetooth device for audio routing',
        context: { deviceName: connectedDevice.name },
      });

      // Update selected devices to use Bluetooth
      const deviceName = connectedDevice.name || 'Bluetooth Device';
      const bluetoothMicrophone = connectedDevice.supportsMicrophoneControl ? { id: connectedDevice.id, name: deviceName, type: 'bluetooth' as const, isAvailable: true } : selectedAudioDevices.microphone;

      const bluetoothSpeaker = {
        id: connectedDevice.id,
        name: deviceName,
        type: 'bluetooth' as const,
        isAvailable: true,
      };

      bluetoothStore.setSelectedMicrophone(bluetoothMicrophone);
      bluetoothStore.setSelectedSpeaker(bluetoothSpeaker);

      // Note: Actual audio routing would be implemented via native modules
      // This is a placeholder for the audio routing logic
      logger.debug({
        message: 'Audio routing configured for Bluetooth device',
      });
    } else {
      // Use default audio devices (selected devices or default)
      logger.debug({
        message: 'Using default audio devices',
        context: { selectedAudioDevices },
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to setup audio routing',
      context: { error },
    });
  }
};

// Map to store web audio elements for cleanup (keyed by track SID)
const webAudioElements = new Map<string, HTMLAudioElement>();
interface LiveKitState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  currentRoom: Room | null;
  currentRoomInfo: DepartmentVoiceChannelResultData | null;
  isTalking: boolean;
  isVoiceEnabled: boolean;
  voipServerWebsocketSslAddress: string;
  callerIdName: string;
  canConnectApiToken: string;
  canConnectToVoiceSession: boolean;
  // Available rooms
  availableRooms: DepartmentVoiceChannelResultData[];

  // UI state
  isBottomSheetVisible: boolean;

  // Actions
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentRoomInfo: (roomInfo: DepartmentVoiceChannelResultData | null) => void;
  setIsTalking: (isTalking: boolean) => void;
  setAvailableRooms: (rooms: DepartmentVoiceChannelResultData[]) => void;
  setIsBottomSheetVisible: (visible: boolean) => void;

  // Room operations
  connectToRoom: (roomInfo: DepartmentVoiceChannelResultData, token: string) => Promise<void>;
  disconnectFromRoom: () => Promise<void>;
  fetchVoiceSettings: () => Promise<void>;
  fetchCanConnectToVoice: () => Promise<void>;
  requestPermissions: () => Promise<void>;

  // Android foreground service
  startAndroidForegroundService: () => Promise<void>;
  stopAndroidForegroundService: () => Promise<void>;
}

export const useLiveKitStore = create<LiveKitState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  currentRoom: null,
  currentRoomInfo: null,
  isTalking: false,
  availableRooms: [],
  isBottomSheetVisible: false,
  isVoiceEnabled: false,
  voipServerWebsocketSslAddress: '',
  callerIdName: '',
  canConnectApiToken: '',
  canConnectToVoiceSession: false,
  setIsConnected: (isConnected) => set({ isConnected }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentRoomInfo: (roomInfo) => set({ currentRoomInfo: roomInfo }),
  setIsTalking: (isTalking) => set({ isTalking }),
  setAvailableRooms: (rooms) => set({ availableRooms: rooms }),
  setIsBottomSheetVisible: (visible) => set({ isBottomSheetVisible: visible }),

  requestPermissions: async () => {
    try {
      if (Platform.OS === 'web') {
        // On web, use the browser's MediaDevices API to request microphone permission
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            // Request microphone access - this will prompt the user for permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release the stream immediately - LiveKit will get its own stream
            stream.getTracks().forEach((track) => {
              track.stop();
            });
            logger.info({
              message: 'Microphone permission granted successfully',
              context: { platform: 'web' },
            });
          } catch (mediaError: any) {
            if (mediaError.name === 'NotAllowedError') {
              logger.error({
                message: 'Microphone permission denied by user',
                context: { platform: 'web', error: mediaError },
              });
              // Only throw on permission denied - this requires user action
              throw mediaError;
            } else if (mediaError.name === 'NotFoundError') {
              // No microphone found - log warning but continue
              // User can still listen and may connect a microphone later
              logger.warn({
                message: 'No microphone device found - voice channel will be listen-only until a microphone is connected',
                context: { platform: 'web' },
              });
            } else {
              logger.warn({
                message: 'Failed to request microphone permission - continuing with limited audio',
                context: { platform: 'web', error: mediaError },
              });
            }
          }
        } else {
          logger.warn({
            message: 'MediaDevices API not available in this browser',
            context: { platform: 'web' },
          });
        }
      } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // Use expo-audio for both Android and iOS microphone permissions
        const micPermission = await getRecordingPermissionsAsync();

        if (!micPermission.granted) {
          const result = await requestRecordingPermissionsAsync();
          if (!result.granted) {
            logger.error({
              message: 'Microphone permission not granted',
              context: { platform: Platform.OS },
            });
            return;
          }
        }

        logger.info({
          message: 'Microphone permission granted successfully',
          context: { platform: Platform.OS },
        });

        // Note: Foreground service permissions are typically handled at the manifest level
        // and don't require runtime permission requests. They are automatically granted
        // when the app is installed if declared in AndroidManifest.xml
        if (Platform.OS === 'android') {
          logger.debug({
            message: 'Foreground service permissions are handled at manifest level',
          });
        }
      }
    } catch (error) {
      logger.error({
        message: 'Failed to request permissions',
        context: { error, platform: Platform.OS },
      });
    }
  },

  connectToRoom: async (roomInfo, token) => {
    try {
      const { currentRoom, voipServerWebsocketSslAddress, requestPermissions } = get();

      // Disconnect from current room if connected
      if (currentRoom) {
        currentRoom.disconnect();
      }

      set({ isConnecting: true });

      // Request microphone permissions before connecting
      await requestPermissions();

      // Create a new room
      const room = new Room();

      // Setup room event listeners
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        logger.info({
          message: 'A participant connected',
          context: { participantIdentity: participant.identity },
        });
        // Play connection sound when others join
        if (participant.identity !== room.localParticipant.identity) {
          //audioService.playConnectToAudioRoomSound();
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        logger.info({
          message: 'A participant disconnected',
          context: { participantIdentity: participant.identity },
        });
        // Play disconnection sound when others leave
        //audioService.playDisconnectedFromAudioRoomSound();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Check if local participant is speaking
        const localParticipant = room.localParticipant;
        const isTalking = speakers.some((speaker) => speaker.sid === localParticipant.sid);
        set({ isTalking });
      });

      // Handle remote audio tracks for web platform
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        // On web, attach audio tracks to DOM elements for playback
        if (Platform.OS === 'web' && track.kind === Track.Kind.Audio) {
          try {
            const audioElement = track.attach();
            const trackSid = track.sid || publication.trackSid;
            if (trackSid) {
              audioElement.id = `livekit-audio-${trackSid}`;
              document.body.appendChild(audioElement);
              webAudioElements.set(trackSid, audioElement);
            }
            logger.debug({
              message: 'Attached audio track for web playback',
              context: { trackSid, participantIdentity: participant.identity },
            });
          } catch (err) {
            logger.error({
              message: 'Failed to attach audio track',
              context: { error: err, trackSid: track.sid },
            });
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        // On web, detach and remove audio elements
        if (Platform.OS === 'web' && track.kind === Track.Kind.Audio) {
          try {
            track.detach().forEach((el) => el.remove());
            const trackSid = track.sid || publication.trackSid;
            if (trackSid) {
              webAudioElements.delete(trackSid);
            }
            logger.debug({
              message: 'Detached audio track',
              context: { trackSid, participantIdentity: participant.identity },
            });
          } catch (err) {
            logger.error({
              message: 'Failed to detach audio track',
              context: { error: err, trackSid: track.sid },
            });
          }
        }
      });

      // Connect to the room
      await room.connect(voipServerWebsocketSslAddress, token);

      // Set microphone to muted by default, camera to disabled (audio-only call)
      // Wrap in try-catch as some platforms may not have devices available yet
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch (micError) {
        logger.warn({
          message: 'Failed to set initial microphone state (will be set when user transmits)',
          context: { error: micError },
        });
      }

      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch (camError) {
        logger.warn({
          message: 'Failed to set initial camera state',
          context: { error: camError },
        });
      }

      // Setup audio routing based on selected devices
      await setupAudioRouting(room);

      await audioService.playConnectToAudioRoomSound();

      // Start foreground service only on Android
      if (Platform.OS === 'android') {
        await get().startAndroidForegroundService();
      }

      set({
        currentRoom: room,
        currentRoomInfo: roomInfo,
        isConnected: true,
        isConnecting: false,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to connect to room',
        context: { error },
      });
      set({ isConnecting: false });
    }
  },

  disconnectFromRoom: async () => {
    const { currentRoom } = get();
    if (currentRoom) {
      // Clean up web audio elements before disconnecting
      if (Platform.OS === 'web') {
        webAudioElements.forEach((audioElement, trackSid) => {
          try {
            audioElement.pause();
            audioElement.remove();
          } catch (err) {
            logger.warn({
              message: 'Failed to clean up audio element',
              context: { error: err, trackSid },
            });
          }
        });
        webAudioElements.clear();
      }

      await currentRoom.disconnect();
      await audioService.playDisconnectedFromAudioRoomSound();

      // Stop foreground service only on Android
      if (Platform.OS === 'android') {
        await get().stopAndroidForegroundService();
      }

      set({
        currentRoom: null,
        currentRoomInfo: null,
        isConnected: false,
      });
    }
  },

  fetchVoiceSettings: async () => {
    try {
      const response = await getDepartmentVoiceSettings();

      let rooms: DepartmentVoiceChannelResultData[] = [];
      if (response.Data.VoiceEnabled && response.Data?.Channels) {
        //rooms.push({
        //  id: '0',
        //  name: 'No Channel Selected',
        //});

        rooms.push(...response.Data.Channels);
      } //else {
      //  rooms.push({
      //    id: '0',
      //    name: 'No Channel Selected',
      //  });
      //}

      set({
        isVoiceEnabled: response.Data.VoiceEnabled,
        voipServerWebsocketSslAddress: response.Data.VoipServerWebsocketSslAddress,
        callerIdName: response.Data.CallerIdName,
        canConnectApiToken: response.Data.CanConnectApiToken,
        availableRooms: rooms,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch rooms',
        context: { error },
      });
    }
  },

  fetchCanConnectToVoice: async () => {
    try {
      const { canConnectApiToken } = get();
      const response = await getCanConnectToVoiceSession(canConnectApiToken);

      if (response && response.Data && response.Data.CanConnect) {
        set({
          canConnectToVoiceSession: response.Data.CanConnect,
        });
      } else {
        set({ canConnectToVoiceSession: false });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to fetch can connect to voice',
        context: { error },
      });
    }
  },

  startAndroidForegroundService: async () => {
    if (Platform.OS !== 'android' || !notifee || !AndroidImportance) return;

    try {
      logger.debug({
        message: 'Starting Android foreground service',
      });

      notifee.registerForegroundService(async () => {
        // Minimal function with no interval or tasks to reduce strain on the main thread
        return new Promise(() => {
          logger.debug({
            message: 'Foreground service registered',
          });
        });
      });

      // Create the notification channel before displaying the notification (required for Android 8+)
      await notifee.createChannel({
        id: 'ptt-channel',
        name: 'PTT Calls',
        description: 'Notifications for active Push-to-Talk calls',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });

      await notifee.displayNotification({
        title: 'Active PTT Call',
        body: 'There is an active PTT call in progress.',
        android: {
          channelId: 'ptt-channel',
          asForegroundService: true,
          smallIcon: 'ic_launcher',
        },
      });

      logger.debug({
        message: 'Android foreground service started successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to start Android foreground service',
        context: { error },
      });
    }
  },

  stopAndroidForegroundService: async () => {
    if (Platform.OS !== 'android' || !notifee) return;

    try {
      logger.debug({
        message: 'Stopping Android foreground service',
      });

      await notifee.stopForegroundService();

      logger.debug({
        message: 'Android foreground service stopped successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to stop Android foreground service',
        context: { error },
      });
    }
  },
}));
