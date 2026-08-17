import { create } from 'zustand';

import { useAuthStore } from '@/lib';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { SignalRService, signalRService } from '@/services/signalr.service';

import { useCoreStore } from '../app/core-store';
import { useChatStore } from '../chat/store';
import { FeatureFlagKeys, featureFlagsStore } from '../feature-flags/store';
import { securityStore, useSecurityStore } from '../security/store';

/** Client-event method names raised by the chat SignalR hub. */
const CHAT_HUB_METHODS = [
  'chatMessageReceived',
  'chatMessageEdited',
  'chatMessageDeleted',
  'chatReactionUpdated',
  'chatReceiptUpdated',
  'chatChannelUpdated',
  'chatChannelProvisioned',
  'chatModerationApplied',
  'chatMessageAckRequired',
  'chatThreadUpdated',
  'chatbotMessageReceived',
  'chatbotTyping',
  'chatTyping',
  'chatPresenceChanged',
  'onChatConnected',
];

// Track registered chat handlers for cleanup and the heartbeat timer.
// Hub methods can send several positional arguments, so handlers are variadic.
const chatHubHandlers: Record<string, ((...args: unknown[]) => void) | null> = {};
let chatHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const CHAT_HEARTBEAT_INTERVAL_MS = 45000;
const CHAT_ARM_RETRY_MS = 5000;
const CHAT_ARM_MAX_ATTEMPTS = 3;
// The hub replays a full resync on arm; collapse the duplicate that arrives when the
// server echoes its own onChatConnected right after ours. Scoped to a single connection —
// a disconnect clears the marker so the next one resyncs immediately.
const CHAT_RESYNC_DEBOUNCE_MS = 2000;

let chatArmRetryTimer: ReturnType<typeof setTimeout> | null = null;
let chatArmAttempts = 0;
// The arm in flight, shared by the reconnect handler and the connectChatHub fallback so a
// fresh connection announces itself exactly once.
let chatArmOperation: Promise<void> | null = null;
let lastChatResyncAt = 0;

function stopChatArmRetry(): void {
  if (chatArmRetryTimer) {
    clearTimeout(chatArmRetryTimer);
    chatArmRetryTimer = null;
  }
}

function unregisterChatHubHandlers(): void {
  Object.keys(chatHubHandlers).forEach((event) => {
    const handler = chatHubHandlers[event];
    if (handler) {
      signalRService.off(event, handler);
      chatHubHandlers[event] = null;
    }
  });
}

function stopChatHeartbeat(): void {
  if (chatHeartbeatTimer) {
    clearInterval(chatHeartbeatTimer);
    chatHeartbeatTimer = null;
  }
}

function resyncChat(): void {
  const now = Date.now();
  if (now - lastChatResyncAt < CHAT_RESYNC_DEBOUNCE_MS) return;
  lastChatResyncAt = now;
  useChatStore.getState().handleChatConnected();
}

/**
 * Announce this connection to the chat hub and restart the heartbeat.
 *
 * The hub only places a connection into its channel groups in response to `Connect`, and
 * every reconnect issues a fresh connection id. Without re-arming, the websocket stays
 * open but the client receives nothing.
 */
async function runChatArm(): Promise<void> {
  stopChatArmRetry();

  try {
    await signalRService.invoke(Env.CHAT_HUB_NAME, 'Connect');
  } catch (error) {
    chatArmAttempts += 1;
    logger.warn({
      message: 'Failed to announce presence to chat hub',
      context: { error, attempt: chatArmAttempts, maxAttempts: CHAT_ARM_MAX_ATTEMPTS },
    });
    if (chatArmAttempts < CHAT_ARM_MAX_ATTEMPTS) {
      chatArmRetryTimer = setTimeout(() => {
        void armChatSession();
      }, CHAT_ARM_RETRY_MS);
    }
    throw error;
  }

  chatArmAttempts = 0;

  stopChatHeartbeat();
  chatHeartbeatTimer = setInterval(() => {
    // Automatic reconnect leaves the hub down for as long as its backoff runs, and no close
    // event fires meanwhile to stop this timer. Skipping the beat costs nothing: the arm that
    // follows the reconnect restarts the heartbeat.
    if (!signalRService.isHubConnected(Env.CHAT_HUB_NAME)) {
      return;
    }
    signalRService.invoke(Env.CHAT_HUB_NAME, 'Heartbeat').catch(() => {
      // Heartbeat is best-effort; ignore transient failures.
    });
  }, CHAT_HEARTBEAT_INTERVAL_MS);

  resyncChat();
}

/**
 * Serializes arming per connection: the reconnect handler and connectChatHub both reach
 * for an arm on a fresh socket, and the reconnect one parks on the connection lock, so
 * without sharing the operation the second issues a duplicate `Connect` and the two runs
 * race each other's retry timer.
 *
 * `resetAttempts` accompanies a new connection id, which always deserves a full budget.
 */
function armChatSession(options?: { resetAttempts?: boolean }): Promise<void> {
  if (options?.resetAttempts) {
    chatArmAttempts = 0;
  }

  if (chatArmOperation) {
    return chatArmOperation;
  }

  const operation = runChatArm().finally(() => {
    if (chatArmOperation === operation) {
      chatArmOperation = null;
    }
  });
  chatArmOperation = operation;
  return operation;
}

export type SignalREventType =
  | 'personnelStatusUpdated'
  | 'personnelStaffingUpdated'
  | 'unitStatusUpdated'
  | 'callsUpdated'
  | 'callAdded'
  | 'callClosed'
  | 'checkInUpdated'
  | 'weatherAlertReceived'
  | 'weatherAlertUpdated'
  | 'weatherAlertExpired'
  | 'incidentCommandUpdated'
  | null;

interface SignalRState {
  isUpdateHubConnected: boolean;
  lastUpdateMessage: unknown;
  lastUpdateTimestamp: number;
  lastEventType: SignalREventType;
  lastPersonnelUpdateTimestamp: number;
  lastUnitsUpdateTimestamp: number;
  lastCallsUpdateTimestamp: number;
  lastCheckInUpdateTimestamp: number;
  lastWeatherAlertTimestamp: number;
  lastIncidentCommandUpdateTimestamp: number;
  isGeolocationHubConnected: boolean;
  lastGeolocationMessage: unknown;
  lastGeolocationTimestamp: number;
  isChatHubConnected: boolean;
  error: Error | null;
  connectUpdateHub: () => Promise<void>;
  disconnectUpdateHub: () => Promise<void>;
  reconnectUpdateHub: () => Promise<void>;
  connectGeolocationHub: () => Promise<void>;
  disconnectGeolocationHub: () => Promise<void>;
  connectChatHub: () => Promise<void>;
  disconnectChatHub: () => Promise<void>;
  checkConnectionState: () => boolean;
}

/**
 * Store event handlers to enable proper cleanup on disconnect
 * These are defined at module scope to ensure they're the same reference
 * for both registering and unregistering
 */
/**
 * A call id is a non-empty string or a finite number and nothing else. Anything looser gets
 * stringified into a plausible-looking id — an array of one becomes its element, an object becomes
 * "[object Object]" — and would be treated as a real incident instead of falling through to the
 * fallback path.
 */
function toCallId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/**
 * The affected incident's call id. Core sends it as a bare string — the eventing worker forwards the
 * topic's ItemId, which is CallId.ToString() — with object payloads tolerated so a producer sending a
 * richer message keeps working.
 */
function extractCommandCallId(message: unknown): string | undefined {
  const scalar = toCallId(message);
  if (scalar !== undefined) {
    return scalar;
  }
  if (message !== null && typeof message === 'object') {
    const m = message as { CallId?: unknown; callId?: unknown };
    return toCallId(m.CallId ?? m.callId);
  }
  return undefined;
}

interface EventHandlers {
  personnelStatusUpdated: ((data: unknown) => void) | null;
  personnelStaffingUpdated: ((data: unknown) => void) | null;
  unitStatusUpdated: ((data: unknown) => void) | null;
  callsUpdated: ((data: unknown) => void) | null;
  callAdded: ((data: unknown) => void) | null;
  callClosed: ((data: unknown) => void) | null;
  checkInUpdated: ((data: unknown) => void) | null;
  weatherAlertReceived: ((data: unknown) => void) | null;
  weatherAlertUpdated: ((data: unknown) => void) | null;
  weatherAlertExpired: ((data: unknown) => void) | null;
  incidentCommandUpdated: ((data: unknown) => void) | null;
  onConnected: ((data: unknown) => void) | null;
}

// Track registered handlers for cleanup
let updateHubHandlers: EventHandlers = {
  personnelStatusUpdated: null,
  personnelStaffingUpdated: null,
  unitStatusUpdated: null,
  callsUpdated: null,
  callAdded: null,
  callClosed: null,
  checkInUpdated: null,
  weatherAlertReceived: null,
  weatherAlertUpdated: null,
  weatherAlertExpired: null,
  incidentCommandUpdated: null,
  onConnected: null,
};

// Rejoining the department group after an update-hub reconnect.
const UPDATE_REJOIN_RETRY_MS = 5000;
const UPDATE_REJOIN_MAX_ATTEMPTS = 3;
let updateRejoinTimer: ReturnType<typeof setTimeout> | null = null;
let updateRejoinAttempts = 0;

function stopUpdateRejoinRetry(): void {
  if (updateRejoinTimer) {
    clearTimeout(updateRejoinTimer);
    updateRejoinTimer = null;
  }
}

/**
 * Lifecycle listeners for the update hub (reconnect/disconnect), kept apart from the method handlers
 * so they can be torn down without touching the event subscriptions.
 */
const updateHubLifecycleHandlers: Record<string, ((...args: unknown[]) => void) | null> = {};

function unregisterUpdateHubLifecycleHandlers(): void {
  Object.keys(updateHubLifecycleHandlers).forEach((event) => {
    const handler = updateHubLifecycleHandlers[event];
    if (handler) {
      signalRService.off(event, handler);
      updateHubLifecycleHandlers[event] = null;
    }
  });
}

/**
 * Helper function to unregister all update hub event handlers
 */
function unregisterUpdateHubHandlers(): void {
  const events: (keyof EventHandlers)[] = [
    'personnelStatusUpdated',
    'personnelStaffingUpdated',
    'unitStatusUpdated',
    'callsUpdated',
    'callAdded',
    'callClosed',
    'checkInUpdated',
    'weatherAlertReceived',
    'weatherAlertUpdated',
    'weatherAlertExpired',
    'incidentCommandUpdated',
    'onConnected',
  ];

  events.forEach((event) => {
    const handler = updateHubHandlers[event];
    if (handler) {
      signalRService.off(event, handler);
      updateHubHandlers[event] = null;
      logger.debug({
        message: `Unregistered handler for ${event}`,
      });
    }
  });
}

export const useSignalRStore = create<SignalRState>((set, get) => ({
  isUpdateHubConnected: false,
  lastUpdateMessage: null,
  lastUpdateTimestamp: 0,
  lastEventType: null,
  lastPersonnelUpdateTimestamp: 0,
  lastUnitsUpdateTimestamp: 0,
  lastCallsUpdateTimestamp: 0,
  lastCheckInUpdateTimestamp: 0,
  lastWeatherAlertTimestamp: 0,
  lastIncidentCommandUpdateTimestamp: 0,
  isGeolocationHubConnected: false,
  lastGeolocationMessage: null,
  lastGeolocationTimestamp: 0,
  isChatHubConnected: false,
  error: null,
  connectUpdateHub: async () => {
    try {
      if (get().isUpdateHubConnected) {
        return;
      }

      set({ isUpdateHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      let coreState = useCoreStore.getState();
      let eventingUrl = coreState.config?.EventingUrl;

      // If config is not loaded yet, wait for it to be fetched
      if (!eventingUrl) {
        logger.info({
          message: 'EventingUrl not available, waiting for config to be fetched...',
        });

        // Check if config is already being initialized
        if (!coreState.isInitialized && !coreState.isInitializing) {
          logger.info({
            message: 'Config not initialized, fetching config before SignalR connection',
          });
          try {
            await useCoreStore.getState().fetchConfig();
          } catch (configError) {
            const errorMessage = 'Failed to fetch config for SignalR connection';
            logger.error({
              message: errorMessage,
              context: { error: configError },
            });
            set({ error: new Error(errorMessage) });
            throw new Error(errorMessage);
          }
        } else if (coreState.isInitializing) {
          // Wait for initialization to complete (poll with timeout)
          logger.info({
            message: 'Config is being initialized, waiting for completion...',
          });
          const maxWaitTime = 10000; // 10 seconds
          const pollInterval = 100; // 100ms
          let waitedTime = 0;

          while (waitedTime < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            waitedTime += pollInterval;
            coreState = useCoreStore.getState();
            if (coreState.isInitialized && coreState.config?.EventingUrl) {
              break;
            }
          }
        }

        // Re-check for eventingUrl after waiting
        coreState = useCoreStore.getState();
        eventingUrl = coreState.config?.EventingUrl;

        if (!eventingUrl) {
          const errorMessage = 'EventingUrl not available in config after waiting. Please ensure config is loaded first.';
          logger.error({
            message: errorMessage,
          });
          set({ error: new Error(errorMessage) });
          throw new Error(errorMessage);
        }

        logger.info({
          message: 'EventingUrl now available, proceeding with SignalR connection',
          context: { eventingUrl },
        });
      }

      // Ensure any previous handlers are cleaned up before registering new ones
      unregisterUpdateHubHandlers();

      // Connect to the eventing hub
      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHANNEL_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.CHANNEL_HUB_NAME,
        methods: [
          'personnelStatusUpdated',
          'personnelStaffingUpdated',
          'unitStatusUpdated',
          'callsUpdated',
          'callAdded',
          'callClosed',
          'checkInUpdated',
          'weatherAlertReceived',
          'weatherAlertUpdated',
          'weatherAlertExpired',
          'incidentCommandUpdated',
          'onConnected',
        ],
      });

      const departmentId = Number(securityStore.getState().rights?.DepartmentId ?? '0');
      if (Number.isFinite(departmentId)) {
        await signalRService.invoke(Env.CHANNEL_HUB_NAME, 'connect', departmentId);
      } else {
        logger.error({
          message: 'Invalid DepartmentId, skipping update hub connect invoke',
          context: { departmentId: securityStore.getState().rights?.DepartmentId },
        });
      }

      // Create and register handlers with stored references for cleanup
      updateHubHandlers.personnelStatusUpdated = (message: unknown) => {
        logger.info({
          message: 'personnelStatusUpdated',
          context: { message },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'personnelStatusUpdated', lastPersonnelUpdateTimestamp: Date.now() });
      };
      signalRService.on('personnelStatusUpdated', updateHubHandlers.personnelStatusUpdated);

      updateHubHandlers.personnelStaffingUpdated = (message: unknown) => {
        logger.info({
          message: 'personnelStaffingUpdated',
          context: { message },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'personnelStaffingUpdated', lastPersonnelUpdateTimestamp: Date.now() });
      };
      signalRService.on('personnelStaffingUpdated', updateHubHandlers.personnelStaffingUpdated);

      updateHubHandlers.unitStatusUpdated = (message: unknown) => {
        logger.info({
          message: 'unitStatusUpdated',
          context: { message },
        });
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now(), lastEventType: 'unitStatusUpdated', lastUnitsUpdateTimestamp: Date.now() });
      };
      signalRService.on('unitStatusUpdated', updateHubHandlers.unitStatusUpdated);

      updateHubHandlers.callsUpdated = (message: unknown) => {
        const now = Date.now();
        logger.info({
          message: 'callsUpdated',
          context: { message, now },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: now, lastEventType: 'callsUpdated', lastCallsUpdateTimestamp: now });
      };
      signalRService.on('callsUpdated', updateHubHandlers.callsUpdated);

      updateHubHandlers.callAdded = (message: unknown) => {
        logger.info({
          message: 'callAdded',
          context: { message },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'callAdded', lastCallsUpdateTimestamp: Date.now() });
      };
      signalRService.on('callAdded', updateHubHandlers.callAdded);

      updateHubHandlers.callClosed = (message: unknown) => {
        logger.info({
          message: 'callClosed',
          context: { message },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'callClosed', lastCallsUpdateTimestamp: Date.now() });
      };
      signalRService.on('callClosed', updateHubHandlers.callClosed);

      updateHubHandlers.checkInUpdated = (message: unknown) => {
        logger.info({
          message: 'checkInUpdated',
          context: { message },
        });
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'checkInUpdated', lastCheckInUpdateTimestamp: Date.now() });
      };
      signalRService.on('checkInUpdated', updateHubHandlers.checkInUpdated);

      // Extract alertId from SignalR weather alert payloads which may be a plain
      // string, a number, or an object with an alertId / WeatherAlertId field.
      const extractAlertId = (message: unknown): string | null => {
        if (typeof message === 'string') return message;
        if (typeof message === 'number') return String(message);
        if (message && typeof message === 'object') {
          const obj = message as Record<string, unknown>;
          const id = obj.alertId ?? obj.AlertId ?? obj.WeatherAlertId ?? obj.id ?? obj.Id;
          if (typeof id === 'string') return id;
          if (typeof id === 'number') return String(id);
        }
        return null;
      };

      updateHubHandlers.weatherAlertReceived = (message: unknown) => {
        logger.info({
          message: 'weatherAlertReceived',
          context: { message },
        });
        const alertId = extractAlertId(message);
        if (!alertId) {
          logger.warn({ message: 'weatherAlertReceived: could not extract alertId', context: { message } });
          return;
        }
        // Lazy import to avoid circular dependency
        const { useWeatherAlertsStore } = require('../weatherAlerts/store');
        useWeatherAlertsStore.getState().handleAlertReceived(alertId);
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'weatherAlertReceived', lastWeatherAlertTimestamp: Date.now() });
      };
      signalRService.on('weatherAlertReceived', updateHubHandlers.weatherAlertReceived);

      updateHubHandlers.weatherAlertUpdated = (message: unknown) => {
        logger.info({
          message: 'weatherAlertUpdated',
          context: { message },
        });
        const alertId = extractAlertId(message);
        if (!alertId) {
          logger.warn({ message: 'weatherAlertUpdated: could not extract alertId', context: { message } });
          return;
        }
        const { useWeatherAlertsStore } = require('../weatherAlerts/store');
        useWeatherAlertsStore.getState().handleAlertUpdated(alertId);
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'weatherAlertUpdated', lastWeatherAlertTimestamp: Date.now() });
      };
      signalRService.on('weatherAlertUpdated', updateHubHandlers.weatherAlertUpdated);

      updateHubHandlers.weatherAlertExpired = (message: unknown) => {
        logger.info({
          message: 'weatherAlertExpired',
          context: { message },
        });
        const alertId = extractAlertId(message);
        if (!alertId) {
          logger.warn({ message: 'weatherAlertExpired: could not extract alertId', context: { message } });
          return;
        }
        const { useWeatherAlertsStore } = require('../weatherAlerts/store');
        useWeatherAlertsStore.getState().handleAlertExpired(alertId);
        set({ lastUpdateMessage: null, lastUpdateTimestamp: Date.now(), lastEventType: 'weatherAlertExpired', lastWeatherAlertTimestamp: Date.now() });
      };
      signalRService.on('weatherAlertExpired', updateHubHandlers.weatherAlertExpired);

      updateHubHandlers.incidentCommandUpdated = (message: unknown) => {
        logger.info({
          message: 'incidentCommandUpdated',
          context: { message },
        });
        // Payload is the affected call id. extractAlertId reads alert-shaped keys and accepts blanks,
        // so the command feed gets its own strict reader.
        const callId = extractCommandCallId(message);
        const now = Date.now();
        set({ lastUpdateMessage: null, lastUpdateTimestamp: now, lastEventType: 'incidentCommandUpdated', lastIncidentCommandUpdateTimestamp: now });
        if (callId) {
          // Lazy import to avoid circular dependency
          const { useIncidentCommandStore } = require('../incident-command/store');
          useIncidentCommandStore.getState().handleIncidentCommandUpdated(callId);
        }
      };
      signalRService.on('incidentCommandUpdated', updateHubHandlers.incidentCommandUpdated);

      updateHubHandlers.onConnected = () => {
        logger.info({
          message: 'Connected to update SignalR hub',
        });
        set({ isUpdateHubConnected: true, error: null });
      };
      signalRService.on('onConnected', updateHubHandlers.onConnected);

      /**
       * An automatic reconnect gets a new connection id, so the department group joined above is gone
       * with the old one — without re-announcing, the app goes quiet and stops seeing other users'
       * board changes until it is backgrounded and resumed. The hub also replays nothing from the
       * outage, so the open board is reloaded once the group is rejoined.
       */
      unregisterUpdateHubLifecycleHandlers();

      const updateReconnected = `${SignalRService.HUB_RECONNECTED_EVENT}:${Env.CHANNEL_HUB_NAME}`;

      /**
       * Rejoin the department group, retrying a few times before giving up.
       *
       * A failed rejoin is silent and total: the socket is up, so nothing looks wrong, but the
       * connection belongs to no group and no board change will ever arrive. Nothing else clears the
       * connected flag either — an automatic reconnect never raises the disconnected event, only a
       * close does — so it has to be cleared here or connectUpdateHub's already-connected guard
       * would block every later repair.
       */
      const rejoinDepartmentGroup = () => {
        const reconnectDepartmentId = Number(securityStore.getState().rights?.DepartmentId ?? '0');
        if (!Number.isFinite(reconnectDepartmentId)) {
          return;
        }
        signalRService
          .invoke(Env.CHANNEL_HUB_NAME, 'connect', reconnectDepartmentId)
          .then(() => {
            stopUpdateRejoinRetry();
            updateRejoinAttempts = 0;
            set({ isUpdateHubConnected: true, error: null });
            logger.info({ message: 'Re-announced to update hub after reconnect; reloading incident command', context: { departmentId: reconnectDepartmentId } });
            // Lazy import to avoid circular dependency
            const { useIncidentCommandStore } = require('../incident-command/store');
            const openCallId = useIncidentCommandStore.getState().callId;
            if (openCallId) {
              useIncidentCommandStore.getState().handleIncidentCommandUpdated(openCallId);
            }
          })
          .catch((error) => {
            updateRejoinAttempts += 1;
            logger.warn({ message: 'Failed to re-announce to update hub after reconnect', context: { error, attempt: updateRejoinAttempts, maxAttempts: UPDATE_REJOIN_MAX_ATTEMPTS } });
            set({ isUpdateHubConnected: false });

            if (updateRejoinAttempts < UPDATE_REJOIN_MAX_ATTEMPTS) {
              stopUpdateRejoinRetry();
              updateRejoinTimer = setTimeout(() => {
                updateRejoinTimer = null;
                rejoinDepartmentGroup();
              }, UPDATE_REJOIN_RETRY_MS);
            } else {
              logger.error({ message: 'Giving up re-announcing to update hub; the next connectUpdateHub will rebuild the session', context: { attempts: updateRejoinAttempts } });
            }
          });
      };

      const onUpdateReconnected = () => {
        stopUpdateRejoinRetry();
        updateRejoinAttempts = 0;
        rejoinDepartmentGroup();
      };
      updateHubLifecycleHandlers[updateReconnected] = onUpdateReconnected;
      signalRService.on(updateReconnected, onUpdateReconnected);

      const updateDisconnected = `${SignalRService.HUB_DISCONNECTED_EVENT}:${Env.CHANNEL_HUB_NAME}`;
      const onUpdateDisconnected = () => {
        // A dropped transport supersedes any rejoin still pending against the old connection, and
        // clearing the flag is what lets connectUpdateHub rebuild the session later.
        stopUpdateRejoinRetry();
        updateRejoinAttempts = 0;
        set({ isUpdateHubConnected: false });
      };
      updateHubLifecycleHandlers[updateDisconnected] = onUpdateDisconnected;
      signalRService.on(updateDisconnected, onUpdateDisconnected);

      // Note: Connection state monitoring is now handled internally by the SignalR service
      // The service properly tracks connection state and will emit events through the registered handlers
      // We don't need to access internal connection objects anymore

      logger.info({
        message: 'Update hub handlers registered successfully',
        context: { listenerCount: signalRService.getTotalEventListenerCount() },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectUpdateHub: async () => {
    try {
      // Unregister all handlers BEFORE disconnecting to prevent memory leaks
      stopUpdateRejoinRetry();
      updateRejoinAttempts = 0;
      unregisterUpdateHubHandlers();
      unregisterUpdateHubLifecycleHandlers();

      await signalRService.disconnectFromHub(Env.CHANNEL_HUB_NAME);
      set({ isUpdateHubConnected: false, lastUpdateMessage: null });

      logger.info({
        message: 'Update hub disconnected and handlers cleaned up',
        context: { remainingListeners: signalRService.getTotalEventListenerCount() },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  reconnectUpdateHub: async () => {
    try {
      logger.info({
        message: 'Manual reconnection requested for update hub',
      });

      // Disconnect first to ensure clean state
      await get().disconnectUpdateHub();

      // Wait a moment before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reconnect
      await get().connectUpdateHub();

      logger.info({
        message: 'Successfully reconnected to update hub',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to manually reconnect to update hub',
        context: { error: err },
      });
      set({ error: err });
      throw err;
    }
  },
  checkConnectionState: () => {
    try {
      // Check the actual connection state from the service
      const isActuallyConnected = signalRService.isHubConnected(Env.CHANNEL_HUB_NAME);
      const currentState = get().isUpdateHubConnected;

      // If the states don't match, update the store
      if (isActuallyConnected !== currentState) {
        logger.info({
          message: 'Connection state mismatch detected, updating store',
          context: { isActuallyConnected, currentState },
        });
        set({ isUpdateHubConnected: isActuallyConnected });
      }

      return isActuallyConnected;
    } catch (error) {
      // If there's an error checking connection state, assume disconnected
      logger.error({
        message: 'Error checking connection state',
        context: { error },
      });
      return false;
    }
  },
  connectGeolocationHub: async () => {
    try {
      if (get().isGeolocationHubConnected) {
        return;
      }

      set({ isGeolocationHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      let coreState = useCoreStore.getState();
      let eventingUrl = coreState.config?.EventingUrl;

      // If config is not loaded yet, wait for it to be fetched
      if (!eventingUrl) {
        logger.info({
          message: 'EventingUrl not available for geolocation hub, waiting for config to be fetched...',
        });

        // Check if config is already being initialized
        if (!coreState.isInitialized && !coreState.isInitializing) {
          logger.info({
            message: 'Config not initialized, fetching config before geolocation hub connection',
          });
          try {
            await useCoreStore.getState().fetchConfig();
          } catch (configError) {
            const errorMessage = 'Failed to fetch config for geolocation hub connection';
            logger.error({
              message: errorMessage,
              context: { error: configError },
            });
            set({ error: new Error(errorMessage) });
            throw new Error(errorMessage);
          }
        } else if (coreState.isInitializing) {
          // Wait for initialization to complete (poll with timeout)
          logger.info({
            message: 'Config is being initialized, waiting for completion before geolocation hub connection...',
          });
          const maxWaitTime = 10000; // 10 seconds
          const pollInterval = 100; // 100ms
          let waitedTime = 0;

          while (waitedTime < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            waitedTime += pollInterval;
            coreState = useCoreStore.getState();
            if (coreState.isInitialized && coreState.config?.EventingUrl) {
              break;
            }
          }
        }

        // Re-check for eventingUrl after waiting
        coreState = useCoreStore.getState();
        eventingUrl = coreState.config?.EventingUrl;

        if (!eventingUrl) {
          const errorMessage = 'EventingUrl not available in config for geolocation hub after waiting';
          logger.error({ message: errorMessage });
          set({ error: new Error(errorMessage) });
          throw new Error(errorMessage);
        }

        logger.info({
          message: 'EventingUrl now available, proceeding with geolocation hub connection',
          context: { eventingUrl },
        });
      }

      // Connect to the geolocation hub (implementation depends on your SignalR service)
      logger.info({ message: 'Geolocation hub connected' });
      set({ isGeolocationHubConnected: true, error: null });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to connect to geolocation hub',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectGeolocationHub: async () => {
    try {
      set({ isGeolocationHubConnected: false, lastGeolocationMessage: null });
      logger.info({ message: 'Geolocation hub disconnected' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to disconnect from geolocation hub',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectChatHub: async () => {
    try {
      // Guard here so every call path (init, app-resume reconnect) honors the flag.
      if (!featureFlagsStore.getState().isEnabled(FeatureFlagKeys.ChatSystem)) {
        logger.info({
          message: 'Chat disabled by feature flag; skipping chat hub connection',
        });
        // Tear down any existing connection so a runtime flag flip-off disconnects the hub.
        await get().disconnectChatHub();
        return;
      }

      if (get().isChatHubConnected) {
        return;
      }

      const eventingUrl = useCoreStore.getState().config?.EventingUrl;
      if (!eventingUrl) {
        logger.warn({ message: 'EventingUrl not available for chat hub, skipping connection' });
        return;
      }

      // Ensure any previous handlers are cleaned up before registering new ones.
      unregisterChatHubHandlers();

      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHAT_HUB_NAME,
        eventingUrl,
        hubName: Env.CHAT_HUB_NAME,
        methods: CHAT_HUB_METHODS,
      });

      const chat = useChatStore.getState();
      const handlerMap: Record<string, (...args: unknown[]) => void> = {
        chatMessageReceived: chat.handleMessageReceived,
        chatMessageEdited: chat.handleMessageEdited,
        chatMessageDeleted: chat.handleMessageDeleted,
        chatReactionUpdated: chat.handleReactionUpdated,
        chatReceiptUpdated: chat.handleReceiptUpdated,
        chatChannelUpdated: chat.handleChannelUpdated,
        chatChannelProvisioned: chat.handleChannelProvisioned,
        chatModerationApplied: chat.handleModerationApplied,
        chatMessageAckRequired: chat.handleAckRequired,
        chatThreadUpdated: chat.handleThreadUpdated,
        chatbotMessageReceived: chat.handleChatbotMessageReceived,
        chatbotTyping: chat.handleChatbotTyping,
        chatTyping: chat.handleTyping,
        chatPresenceChanged: chat.handlePresenceChanged,
      };

      Object.entries(handlerMap).forEach(([event, handler]) => {
        const wrapped = (...args: unknown[]) => handler(...args);
        chatHubHandlers[event] = wrapped;
        signalRService.on(event, wrapped);
      });

      const onChatConnected = () => {
        logger.info({ message: 'Connected to chat SignalR hub' });
        set({ isChatHubConnected: true, error: null });
        resyncChat();
      };
      chatHubHandlers.onChatConnected = onChatConnected;
      signalRService.on('onChatConnected', onChatConnected);

      // A dropped transport reconnects with a fresh connection id that belongs to no
      // channel groups, so it has to announce itself again or the socket stays open and
      // silent.
      const chatReconnected = `${SignalRService.HUB_RECONNECTED_EVENT}:${Env.CHAT_HUB_NAME}`;
      const chatDisconnected = `${SignalRService.HUB_DISCONNECTED_EVENT}:${Env.CHAT_HUB_NAME}`;

      const onChatReconnected = () => {
        void armChatSession({ resetAttempts: true }).catch(() => {
          // runChatArm already logged and scheduled its retry.
        });
      };
      chatHubHandlers[chatReconnected] = onChatReconnected;
      signalRService.on(chatReconnected, onChatReconnected);

      const onChatDisconnected = () => {
        stopChatHeartbeat();
        stopChatArmRetry();
        // The debounce only guards duplicates within one connection; carrying the marker
        // across the gap would swallow the resync that backfills the outage.
        lastChatResyncAt = 0;
        // Clearing the flag is what lets connectChatHub repair the session later; while it
        // stayed true the hub could never be re-announced.
        set({ isChatHubConnected: false });
      };
      chatHubHandlers[chatDisconnected] = onChatDisconnected;
      signalRService.on(chatDisconnected, onChatDisconnected);

      // Announce chat presence to the hub, then begin the periodic heartbeat.
      await armChatSession({ resetAttempts: true });
      set({ isChatHubConnected: true });

      logger.info({ message: 'Chat hub handlers registered successfully' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to connect to chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
  disconnectChatHub: async () => {
    try {
      stopChatHeartbeat();
      stopChatArmRetry();
      chatArmAttempts = 0;
      lastChatResyncAt = 0;
      unregisterChatHubHandlers();
      await signalRService.disconnectFromHub(Env.CHAT_HUB_NAME);
      set({ isChatHubConnected: false });
      logger.info({ message: 'Chat hub disconnected and handlers cleaned up' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to disconnect from chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
}));
