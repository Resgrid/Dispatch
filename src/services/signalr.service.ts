import { type HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Platform } from 'react-native';

import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { isElectron } from '@/lib/platform';
import useAuthStore from '@/stores/auth/store';

export interface SignalRHubConfig {
  name: string;
  url: string;
  methods: string[];
}

export interface SignalRHubConnectConfig {
  name: string;
  eventingUrl: string; // Base EventingUrl from config (trailing slash will be added if missing)
  hubName: string;
  methods: string[];
}

export interface SignalRMessage {
  type: string;
  data: unknown;
}

/** Hub events can carry multiple positional arguments; listeners receive all of them. */
export type SignalREventListener = (...data: unknown[]) => void;

export enum HubConnectingState {
  IDLE = 'idle',
  RECONNECTING = 'reconnecting',
  DIRECT_CONNECTING = 'direct-connecting',
}

/**
 * Type for registered hub method handlers to enable proper cleanup
 */
interface HubMethodHandler {
  method: string;
  handler: SignalREventListener;
}

/**
 * SignalR Service - Manages SignalR hub connections with proper lifecycle management
 * for web and native platforms. Handles memory leak prevention, connection pooling,
 * and proper cleanup.
 */
class SignalRService {
  /**
   * Per-hub transport lifecycle signals. Group membership is scoped to a connection id, so
   * a subscriber that joined server-side groups has to re-announce itself after every
   * reconnect — these are how it learns that happened.
   */
  public static readonly HUB_DISCONNECTED_EVENT = '__hubDisconnected';
  public static readonly HUB_RECONNECTED_EVENT = '__hubReconnected';

  private connections: Map<string, HubConnection> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private hubConfigs: Map<string, SignalRHubConnectConfig> = new Map();
  private connectionLocks: Map<string, Promise<void>> = new Map();
  private reconnectingHubs: Set<string> = new Set();
  private hubStates: Map<string, HubConnectingState> = new Map();

  // Track timeouts for cleanup
  private reconnectTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Track registered method handlers per hub for cleanup
  private hubMethodHandlers: Map<string, HubMethodHandler[]> = new Map();

  // Event emitter with proper cleanup tracking
  private eventListeners: Map<string, Set<SignalREventListener>> = new Map();

  // Web platform visibility tracking
  private isPageVisible: boolean = true;
  private visibilityChangeHandler: (() => void) | null = null;

  // Abort controllers for cancelling pending operations
  private pendingConnections: Map<string, AbortController> = new Map();

  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000; // 5 seconds
  private readonly RECONNECT_BACKOFF_MULTIPLIER = 1.5;

  /**
   * How long the client waits for any server message before declaring the connection dead.
   * The client default of 30s is two server keepalive pings; a browser that froze the tab or
   * a laptop that briefly slept blows straight past it and tears down a socket that was fine.
   * 60s rides out one missed ping window at the cost of a slower dead-socket detection.
   */
  private readonly SERVER_TIMEOUT_MS = 60000;

  private static instance: SignalRService | null = null;

  private constructor() {
    this.setupVisibilityHandling();
  }

  public static getInstance(): SignalRService {
    if (!SignalRService.instance) {
      SignalRService.instance = new SignalRService();
      logger.info({
        message: 'SignalR service singleton instance created',
      });
    }

    return SignalRService.instance;
  }

  /**
   * Set up visibility change handling for web platform
   * This prevents reconnection attempts when the tab is not visible
   */
  private setupVisibilityHandling(): void {
    if (Platform.OS !== 'web') {
      return;
    }

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // In Electron, minimizing the window sets visibilityState to 'hidden',
    // which would stall reconnects; skip visibility-based handling there
    if (isElectron()) {
      return;
    }

    this.visibilityChangeHandler = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = document.visibilityState === 'visible';

      logger.debug({
        message: 'Page visibility changed',
        context: { wasVisible, isNowVisible: this.isPageVisible },
      });

      if (!wasVisible && this.isPageVisible) {
        // Page became visible - check connections and reconnect if needed
        this.checkAndReconnectOnVisibilityResume();
      } else if (wasVisible && !this.isPageVisible) {
        // Page became hidden - cancel pending reconnects to save resources
        this.cancelAllPendingReconnects();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Clean up visibility handling on service destruction
   */
  private cleanupVisibilityHandling(): void {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !this.visibilityChangeHandler) {
      return;
    }

    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.visibilityChangeHandler = null;
  }

  /**
   * Cancel all pending reconnection timeouts
   */
  private cancelAllPendingReconnects(): void {
    this.reconnectTimeouts.forEach((timeoutId, hubName) => {
      clearTimeout(timeoutId);
      logger.debug({
        message: `Cancelled pending reconnect for hub: ${hubName}`,
      });
    });
    this.reconnectTimeouts.clear();
  }

  /**
   * Cancel a specific pending reconnection timeout
   */
  private cancelPendingReconnect(hubName: string): void {
    const timeoutId = this.reconnectTimeouts.get(hubName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.reconnectTimeouts.delete(hubName);
      logger.debug({
        message: `Cancelled pending reconnect for hub: ${hubName}`,
      });
    }
  }

  /**
   * Check connections and attempt reconnection for disconnected hubs when page becomes visible
   */
  private async checkAndReconnectOnVisibilityResume(): Promise<void> {
    logger.info({
      message: 'Checking connections after visibility resume',
    });

    // Check each configured hub and reconnect if disconnected
    for (const [hubName, config] of this.hubConfigs) {
      const connection = this.connections.get(hubName);
      const isConnected = connection?.state === HubConnectionState.Connected;

      if (!isConnected && !this.isHubConnecting(hubName)) {
        logger.info({
          message: `Hub ${hubName} is disconnected, attempting reconnection after visibility resume`,
        });

        // Reset reconnect attempts on visibility resume to give fresh attempts
        this.reconnectAttempts.set(hubName, 0);

        try {
          await this.connectToHubWithEventingUrl(config);
        } catch (error) {
          logger.error({
            message: `Failed to reconnect hub ${hubName} after visibility resume`,
            context: { error },
          });
        }
      }
    }
  }

  /**
   * Check if a hub is connected or in the process of connecting
   */
  public isHubAvailable(hubName: string): boolean {
    return this.connections.has(hubName) || this.isHubConnecting(hubName);
  }

  /**
   * Check if a hub is in any connecting state (reconnecting or direct-connecting)
   */
  private isHubConnecting(hubName: string): boolean {
    const state = this.hubStates.get(hubName);
    return state === HubConnectingState.RECONNECTING || state === HubConnectingState.DIRECT_CONNECTING;
  }

  /**
   * Check if a hub is specifically in reconnecting state
   * @deprecated Use for testing purposes only
   */
  public isHubReconnecting(hubName: string): boolean {
    return this.hubStates.get(hubName) === HubConnectingState.RECONNECTING;
  }

  /**
   * Set hub state and manage legacy reconnectingHubs set for backward compatibility
   */
  private setHubState(hubName: string, state: HubConnectingState): void {
    if (state === HubConnectingState.IDLE) {
      this.hubStates.delete(hubName);
      this.reconnectingHubs.delete(hubName);
    } else {
      this.hubStates.set(hubName, state);
      if (state === HubConnectingState.RECONNECTING) {
        this.reconnectingHubs.add(hubName);
      } else {
        this.reconnectingHubs.delete(hubName);
      }
    }
  }

  public async connectToHubWithEventingUrl(config: SignalRHubConnectConfig): Promise<void> {
    // Check for existing lock to prevent concurrent connections to the same hub
    const existingLock = this.connectionLocks.get(config.name);
    if (existingLock) {
      logger.info({
        message: `Connection to hub ${config.name} is already in progress, waiting...`,
      });
      await existingLock;
      return;
    }

    // Create a new connection promise and store it as a lock
    const connectionPromise = this._connectToHubWithEventingUrlInternal(config);
    this.connectionLocks.set(config.name, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      // Remove the lock after connection completes (success or failure)
      this.connectionLocks.delete(config.name);
    }
  }

  /**
   * Clean up method handlers registered on a connection
   */
  private cleanupHubMethodHandlers(hubName: string, connection: HubConnection): void {
    const handlers = this.hubMethodHandlers.get(hubName);
    if (handlers) {
      handlers.forEach(({ method, handler }) => {
        try {
          connection.off(method, handler);
          logger.debug({
            message: `Unregistered method handler: ${method} from hub: ${hubName}`,
          });
        } catch (error) {
          // Connection might already be disposed
          logger.debug({
            message: `Could not unregister method handler: ${method} from hub: ${hubName}`,
            context: { error },
          });
        }
      });
      this.hubMethodHandlers.delete(hubName);
    }
  }

  private async _connectToHubWithEventingUrlInternal(config: SignalRHubConnectConfig): Promise<void> {
    // Create an AbortController for this connection attempt
    const abortController = new AbortController();
    const previousController = this.pendingConnections.get(config.name);

    // Cancel any previous pending connection
    if (previousController) {
      previousController.abort();
    }

    this.pendingConnections.set(config.name, abortController);

    try {
      // Check if aborted before starting
      if (abortController.signal.aborted) {
        throw new Error('Connection attempt was cancelled');
      }

      if (this.connections.has(config.name)) {
        logger.info({
          message: `Already connected to hub: ${config.name}`,
        });
        return;
      }

      // Check if hub is already in direct-connecting state to prevent duplicates
      const currentState = this.hubStates.get(config.name);
      if (currentState === HubConnectingState.DIRECT_CONNECTING) {
        logger.info({
          message: `Hub ${config.name} is already in direct-connecting state, skipping duplicate connection attempt`,
        });
        return;
      }

      // Log if hub is reconnecting but proceed with direct connection attempt
      if (currentState === HubConnectingState.RECONNECTING) {
        logger.info({
          message: `Hub ${config.name} is currently reconnecting, proceeding with direct connection attempt`,
        });
      }

      // Mark as direct-connecting
      this.setHubState(config.name, HubConnectingState.DIRECT_CONNECTING);

      const token = useAuthStore.getState().accessToken;
      if (!token) {
        throw new Error('No authentication token available');
      }

      if (!config.eventingUrl) {
        throw new Error('EventingUrl is required for SignalR connection');
      }

      // Parse the incoming eventingUrl into path and query components
      const url = new URL(config.eventingUrl);

      // Append the hub name to the path (ensuring a single slash)
      const pathWithHub = url.pathname.endsWith('/') ? `${url.pathname}${config.hubName}` : `${url.pathname}/${config.hubName}`;

      // Reassemble the URL with the hub in the path
      let fullUrl = `${url.protocol}//${url.host}${pathWithHub}`;

      // For geolocation hub, add token as URL parameter instead of header
      const isGeolocationHub = config.hubName === Env.REALTIME_GEO_HUB_NAME;

      // Merge existing query parameters with access_token if needed
      const queryParams = new URLSearchParams(url.search);
      if (isGeolocationHub) {
        queryParams.set('access_token', token);
      }

      // Add query string if there are any parameters
      if (queryParams.toString()) {
        fullUrl = `${fullUrl}?${queryParams.toString()}`;
      }

      logger.info({
        message: `Connecting to hub: ${config.name}`,
        context: { config, fullUrl: isGeolocationHub ? fullUrl.replace(/access_token=[^&]+/, 'access_token=***') : fullUrl },
      });

      // Store the config for potential reconnections
      this.hubConfigs.set(config.name, config);

      // Check if aborted before building connection
      if (abortController.signal.aborted) {
        throw new Error('Connection attempt was cancelled');
      }

      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(
          fullUrl,
          isGeolocationHub
            ? {}
            : {
                accessTokenFactory: () => token,
              }
        )
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .withServerTimeout(this.SERVER_TIMEOUT_MS)
        .configureLogging(LogLevel.Warning);

      const connection = connectionBuilder.build();

      // Set up event handlers
      connection.onclose(() => {
        this.emitHubLifecycle(SignalRService.HUB_DISCONNECTED_EVENT, config.name);
        this.handleConnectionClose(config.name);
      });

      connection.onreconnecting((error) => {
        logger.warn({
          message: `Reconnecting to hub: ${config.name}`,
          context: { error },
        });
      });

      connection.onreconnected((connectionId) => {
        logger.info({
          message: `Reconnected to hub: ${config.name}`,
          context: { connectionId },
        });
        this.reconnectAttempts.set(config.name, 0);
        // A reconnect issues a new connection id, so any server-side group this connection
        // belonged to is gone. Subscribers must re-announce themselves.
        this.emitHubLifecycle(SignalRService.HUB_RECONNECTED_EVENT, config.name);
      });

      // Initialize handlers array for this hub
      this.hubMethodHandlers.set(config.name, []);

      // Register all methods and track handlers for cleanup
      config.methods.forEach((method) => {
        logger.info({
          message: `Registering ${method} message from hub: ${config.name}`,
          context: { method },
        });

        const handler = (...args: unknown[]) => {
          logger.info({
            message: `Received ${method} message from hub: ${config.name}`,
            context: { method, args },
          });
          this.handleMessage(config.name, method, args);
        };

        connection.on(method, handler);

        // Track the handler for cleanup
        const handlers = this.hubMethodHandlers.get(config.name);
        if (handlers) {
          handlers.push({ method, handler });
        }
      });

      // Check if aborted before starting connection
      if (abortController.signal.aborted) {
        // Clean up the connection we built
        this.cleanupHubMethodHandlers(config.name, connection);
        throw new Error('Connection attempt was cancelled');
      }

      await connection.start();
      this.connections.set(config.name, connection);
      this.reconnectAttempts.set(config.name, 0);

      // Clear the direct-connecting state on successful connection
      this.setHubState(config.name, HubConnectingState.IDLE);

      // Clear any pending reconnect timeout since we're now connected
      this.cancelPendingReconnect(config.name);

      logger.info({
        message: `Connected to hub: ${config.name}`,
      });
    } catch (error) {
      // Clear the direct-connecting state on failed connection
      this.setHubState(config.name, HubConnectingState.IDLE);

      // Don't log cancellation errors as errors
      if (abortController.signal.aborted) {
        logger.debug({
          message: `Connection attempt to hub ${config.name} was cancelled`,
        });
        return;
      }

      logger.error({
        message: `Failed to connect to hub: ${config.name}`,
        context: { error },
      });
      throw error;
    } finally {
      // Clean up the abort controller
      if (this.pendingConnections.get(config.name) === abortController) {
        this.pendingConnections.delete(config.name);
      }
    }
  }

  public async connectToHub(config: SignalRHubConfig): Promise<void> {
    // Check for existing lock to prevent concurrent connections to the same hub
    const existingLock = this.connectionLocks.get(config.name);
    if (existingLock) {
      logger.info({
        message: `Connection to hub ${config.name} is already in progress, waiting...`,
      });
      await existingLock;
      return;
    }

    // Create a new connection promise and store it as a lock
    const connectionPromise = this._connectToHubInternal(config);
    this.connectionLocks.set(config.name, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      // Remove the lock after connection completes (success or failure)
      this.connectionLocks.delete(config.name);
    }
  }

  private async _connectToHubInternal(config: SignalRHubConfig): Promise<void> {
    // Create an AbortController for this connection attempt
    const abortController = new AbortController();
    const previousController = this.pendingConnections.get(config.name);

    // Cancel any previous pending connection
    if (previousController) {
      previousController.abort();
    }

    this.pendingConnections.set(config.name, abortController);

    try {
      // Check if aborted before starting
      if (abortController.signal.aborted) {
        throw new Error('Connection attempt was cancelled');
      }

      if (this.connections.has(config.name)) {
        logger.info({
          message: `Already connected to hub: ${config.name}`,
        });
        return;
      }

      // Check if hub is already in direct-connecting state to prevent duplicates
      const currentState = this.hubStates.get(config.name);
      if (currentState === HubConnectingState.DIRECT_CONNECTING) {
        logger.info({
          message: `Hub ${config.name} is already in direct-connecting state, skipping duplicate connection attempt`,
        });
        return;
      }

      // Log if hub is reconnecting but proceed with direct connection attempt
      if (currentState === HubConnectingState.RECONNECTING) {
        logger.info({
          message: `Hub ${config.name} is currently reconnecting, proceeding with direct connection attempt`,
        });
      }

      // Mark as direct-connecting
      this.setHubState(config.name, HubConnectingState.DIRECT_CONNECTING);

      const token = useAuthStore.getState().accessToken;
      if (!token) {
        throw new Error('No authentication token available');
      }

      logger.info({
        message: `Connecting to hub: ${config.name}`,
        context: { config },
      });

      // Check if aborted before building connection
      if (abortController.signal.aborted) {
        throw new Error('Connection attempt was cancelled');
      }

      const connection = new HubConnectionBuilder()
        .withUrl(config.url, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .withServerTimeout(this.SERVER_TIMEOUT_MS)
        .configureLogging(LogLevel.Warning)
        .build();

      // Set up event handlers
      connection.onclose(() => {
        this.emitHubLifecycle(SignalRService.HUB_DISCONNECTED_EVENT, config.name);
        this.handleConnectionClose(config.name);
      });

      connection.onreconnecting((error) => {
        logger.warn({
          message: `Reconnecting to hub: ${config.name}`,
          context: { error },
        });
      });

      connection.onreconnected((connectionId) => {
        logger.info({
          message: `Reconnected to hub: ${config.name}`,
          context: { connectionId },
        });
        this.reconnectAttempts.set(config.name, 0);
        // A reconnect issues a new connection id, so any server-side group this connection
        // belonged to is gone. Subscribers must re-announce themselves.
        this.emitHubLifecycle(SignalRService.HUB_RECONNECTED_EVENT, config.name);
      });

      // Initialize handlers array for this hub
      this.hubMethodHandlers.set(config.name, []);

      // Register all methods and track handlers for cleanup
      config.methods.forEach((method) => {
        logger.info({
          message: `Registering ${method} message from hub: ${config.name}`,
          context: { method },
        });

        const handler = (...args: unknown[]) => {
          logger.info({
            message: `Received ${method} message from hub: ${config.name}`,
            context: { method, args },
          });
          this.handleMessage(config.name, method, args);
        };

        connection.on(method, handler);

        // Track the handler for cleanup
        const handlers = this.hubMethodHandlers.get(config.name);
        if (handlers) {
          handlers.push({ method, handler });
        }
      });

      // Check if aborted before starting connection
      if (abortController.signal.aborted) {
        // Clean up the connection we built
        this.cleanupHubMethodHandlers(config.name, connection);
        throw new Error('Connection attempt was cancelled');
      }

      await connection.start();
      this.connections.set(config.name, connection);
      this.reconnectAttempts.set(config.name, 0);

      // Clear the direct-connecting state on successful connection
      this.setHubState(config.name, HubConnectingState.IDLE);

      // Clear any pending reconnect timeout since we're now connected
      this.cancelPendingReconnect(config.name);

      logger.info({
        message: `Connected to hub: ${config.name}`,
      });
    } catch (error) {
      // Clear the direct-connecting state on failed connection
      this.setHubState(config.name, HubConnectingState.IDLE);

      // Don't log cancellation errors as errors
      if (abortController.signal.aborted) {
        logger.debug({
          message: `Connection attempt to hub ${config.name} was cancelled`,
        });
        return;
      }

      logger.error({
        message: `Failed to connect to hub: ${config.name}`,
        context: { error },
      });
      throw error;
    } finally {
      // Clean up the abort controller
      if (this.pendingConnections.get(config.name) === abortController) {
        this.pendingConnections.delete(config.name);
      }
    }
  }

  private handleConnectionClose(hubName: string): void {
    // Cancel any existing reconnect timeout for this hub
    this.cancelPendingReconnect(hubName);

    const attempts = this.reconnectAttempts.get(hubName) || 0;
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts.set(hubName, attempts + 1);
      const currentAttempts = attempts + 1;

      const hubConfig = this.hubConfigs.get(hubName);
      if (hubConfig) {
        // Calculate backoff delay
        const backoffDelay = Math.min(this.RECONNECT_INTERVAL * Math.pow(this.RECONNECT_BACKOFF_MULTIPLIER, attempts), 30000);

        logger.info({
          message: `Scheduling reconnection attempt ${currentAttempts}/${this.MAX_RECONNECT_ATTEMPTS} for hub: ${hubName}`,
          context: { backoffDelay },
        });

        // Store the timeout ID for cleanup
        const timeoutId = setTimeout(async () => {
          // Remove the timeout from tracking
          this.reconnectTimeouts.delete(hubName);

          // On web (except Electron, where minimize hides the window), check if page is visible before reconnecting
          if (Platform.OS === 'web' && !isElectron() && !this.isPageVisible) {
            logger.debug({
              message: `Skipping reconnection for hub ${hubName} - page is not visible`,
            });
            return;
          }

          try {
            // Check if the hub config was removed (e.g., by explicit disconnect)
            const currentHubConfig = this.hubConfigs.get(hubName);
            if (!currentHubConfig) {
              logger.debug({
                message: `Hub ${hubName} config was removed, skipping reconnection attempt`,
              });
              return;
            }

            // If a live connection exists, skip; if it's stale/closed, drop it
            const existingConn = this.connections.get(hubName);
            if (existingConn && existingConn.state === HubConnectionState.Connected) {
              logger.debug({
                message: `Hub ${hubName} is already connected, skipping reconnection attempt`,
              });
              return;
            }

            // Mark as reconnecting and remove stale entry (if any) to allow a fresh connect
            this.setHubState(hubName, HubConnectingState.RECONNECTING);
            if (existingConn) {
              // Clean up method handlers before removing connection
              this.cleanupHubMethodHandlers(hubName, existingConn);
              this.connections.delete(hubName);
            }

            try {
              // Refresh authentication token before reconnecting
              logger.info({
                message: `Refreshing authentication token before reconnecting to hub: ${hubName}`,
              });

              await useAuthStore.getState().refreshAccessToken();

              // Verify we have a valid token after refresh
              const token = useAuthStore.getState().accessToken;
              if (!token) {
                throw new Error('No valid authentication token available after refresh');
              }

              logger.info({
                message: `Token refreshed successfully, attempting to reconnect to hub: ${hubName} (attempt ${currentAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
              });

              // Remove the connection from our maps to allow fresh connection
              // This is now safe because we have the reconnecting flag set
              this.connections.delete(hubName);

              await this.connectToHubWithEventingUrl(currentHubConfig);

              // Clear reconnecting state on successful reconnection
              this.setHubState(hubName, HubConnectingState.IDLE);

              logger.info({
                message: `Successfully reconnected to hub: ${hubName} after ${currentAttempts} attempts`,
              });
            } catch (reconnectionError) {
              // Clear reconnecting state on failed reconnection
              this.setHubState(hubName, HubConnectingState.IDLE);

              logger.error({
                message: `Failed to refresh token or reconnect to hub: ${hubName}`,
                context: { error: reconnectionError, attempts: currentAttempts, maxAttempts: this.MAX_RECONNECT_ATTEMPTS },
              });

              // Re-throw to trigger the outer catch block
              throw reconnectionError;
            }
          } catch (error) {
            // This catch block handles the overall reconnection attempt failure
            // The reconnecting flag has already been cleared in the inner catch block
            logger.error({
              message: `Reconnection attempt failed for hub: ${hubName}`,
              context: { error, attempts: currentAttempts, maxAttempts: this.MAX_RECONNECT_ATTEMPTS },
            });

            // Schedule the next attempt: the connection is already closed, so no further
            // close event will fire to re-trigger reconnection, and without this the hub
            // stays dead until an app lifecycle event. Backoff grows via the attempts
            // counter, so this cannot spin a rapid retry loop.
            this.handleConnectionClose(hubName);
          }
        }, backoffDelay);

        // Track the timeout for cleanup
        this.reconnectTimeouts.set(hubName, timeoutId);
      } else {
        logger.error({
          message: `No stored config found for hub: ${hubName}, cannot attempt reconnection`,
        });
      }
    } else {
      logger.error({
        message: `Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached for hub: ${hubName}`,
      });

      // Clean up resources for this failed connection
      const connection = this.connections.get(hubName);
      if (connection) {
        this.cleanupHubMethodHandlers(hubName, connection);
      }
      this.connections.delete(hubName);
      this.reconnectAttempts.delete(hubName);
      this.hubConfigs.delete(hubName);
      this.setHubState(hubName, HubConnectingState.IDLE);
    }
  }

  private handleMessage(hubName: string, method: string, args: unknown[]): void {
    logger.debug({
      message: `Received message from hub: ${hubName}`,
      context: { method, args },
    });
    // Emit event for subscribers using the method name as the event name. Hub methods
    // can send more than one argument (chatPresenceChanged sends `userId, isOnline`),
    // so forward every argument to the listeners.
    this.emit(method, ...args);
  }

  public async disconnectFromHub(hubName: string): Promise<void> {
    // Cancel any pending reconnection timeout
    this.cancelPendingReconnect(hubName);

    // Cancel any pending connection attempt
    const pendingConnection = this.pendingConnections.get(hubName);
    if (pendingConnection) {
      pendingConnection.abort();
      this.pendingConnections.delete(hubName);
    }

    // Wait for any ongoing connection attempt to complete
    const existingLock = this.connectionLocks.get(hubName);
    if (existingLock) {
      logger.info({
        message: `Waiting for ongoing connection to hub ${hubName} to complete before disconnecting`,
      });
      try {
        await existingLock;
      } catch (error) {
        // Ignore connection errors when we're trying to disconnect
        logger.debug({
          message: `Connection attempt failed while waiting to disconnect from hub ${hubName}`,
          context: { error },
        });
      }
    }

    const connection = this.connections.get(hubName);
    if (connection) {
      try {
        // Clean up method handlers
        this.cleanupHubMethodHandlers(hubName, connection);

        await connection.stop();
        this.connections.delete(hubName);
        this.reconnectAttempts.delete(hubName);
        this.hubConfigs.delete(hubName);
        this.setHubState(hubName, HubConnectingState.IDLE);
        logger.info({
          message: `Disconnected from hub: ${hubName}`,
        });
      } catch (error) {
        logger.error({
          message: `Error disconnecting from hub: ${hubName}`,
          context: { error },
        });
        throw error;
      }
    } else {
      // Even if no connection exists, clear the state in case it's set
      this.setHubState(hubName, HubConnectingState.IDLE);
      this.reconnectAttempts.delete(hubName);
      this.hubConfigs.delete(hubName);
    }
  }

  public async invoke(hubName: string, method: string, ...args: unknown[]): Promise<void> {
    // Wait for any ongoing connection attempt to complete
    const existingLock = this.connectionLocks.get(hubName);
    if (existingLock) {
      logger.debug({
        message: `Waiting for ongoing connection to hub ${hubName} to complete before invoking method`,
        context: { method },
      });
      await existingLock;
    }

    const connection = this.connections.get(hubName);
    if (connection) {
      // withAutomaticReconnect keeps the connection object alive while the transport is
      // down, so a live map entry is not proof anything can be sent. Invoking anyway throws
      // "Cannot send data if the connection is not in the 'Connected' State" from inside the
      // SignalR client, which reaches error reporting with no hint of which hub it came from.
      if (connection.state !== HubConnectionState.Connected) {
        logger.warn({
          message: `Skipping invoke of method ${method} on hub: ${hubName} - connection is not connected`,
          context: { state: connection.state },
        });
        throw new Error(`Cannot invoke method ${method} on hub ${hubName}: hub is not connected`);
      }

      try {
        return await connection.invoke(method, ...args);
      } catch (error) {
        // A drop between the state check and the send is transport noise, not a hub fault.
        if (connection.state !== HubConnectionState.Connected) {
          logger.warn({
            message: `Invoke of method ${method} on hub ${hubName} was interrupted by a connection drop`,
            context: { error, state: connection.state },
          });
          throw error;
        }

        logger.error({
          message: `Error invoking method ${method} from hub: ${hubName}`,
          context: { error },
        });
        throw error;
      }
    } else if (this.reconnectingHubs.has(hubName)) {
      throw new Error(`Cannot invoke method ${method} on hub ${hubName}: hub is currently reconnecting`);
    } else {
      throw new Error(`Cannot invoke method ${method} on hub ${hubName}: hub is not connected`);
    }
  }

  // Method to reset the singleton instance (primarily for testing)
  public static resetInstance(): void {
    if (SignalRService.instance) {
      // Clean up visibility handling
      SignalRService.instance.cleanupVisibilityHandling();

      // Cancel all pending reconnects
      SignalRService.instance.cancelAllPendingReconnects();

      // Cancel all pending connections
      SignalRService.instance.pendingConnections.forEach((controller) => {
        controller.abort();
      });
      SignalRService.instance.pendingConnections.clear();

      // Clean up all method handlers
      SignalRService.instance.connections.forEach((connection, hubName) => {
        SignalRService.instance!.cleanupHubMethodHandlers(hubName, connection);
      });

      // Clear all event listeners
      SignalRService.instance.eventListeners.clear();

      // Disconnect all connections before resetting
      SignalRService.instance.disconnectAll().catch((error) => {
        logger.error({
          message: 'Error disconnecting all hubs during instance reset',
          context: { error },
        });
      });
    }
    SignalRService.instance = null;
    logger.debug({
      message: 'SignalR service singleton instance reset',
    });
  }

  public async disconnectAll(): Promise<void> {
    // Cancel all pending reconnects first
    this.cancelAllPendingReconnects();

    // Cancel all pending connections
    this.pendingConnections.forEach((controller) => {
      controller.abort();
    });
    this.pendingConnections.clear();

    const disconnectPromises = Array.from(this.connections.keys()).map((hubName) => this.disconnectFromHub(hubName));
    await Promise.all(disconnectPromises);
  }

  // Event emitter methods - note: eventListeners is declared in the class properties above
  public on(event: string, callback: SignalREventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  public off(event: string, callback: SignalREventListener): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Remove all listeners for a specific event
   */
  public offAll(event: string): void {
    this.eventListeners.delete(event);
  }

  /**
   * Remove all event listeners (useful for cleanup)
   */
  public removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /** Raises a lifecycle signal both unqualified and scoped to the hub that produced it. */
  private emitHubLifecycle(event: string, hubName: string): void {
    this.emit(event, hubName);
    this.emit(`${event}:${hubName}`, hubName);
  }

  private emit(event: string, ...data: unknown[]): void {
    this.eventListeners.get(event)?.forEach((callback) => {
      try {
        callback(...data);
      } catch (error) {
        logger.error({
          message: `Error in event listener for event: ${event}`,
          context: { error },
        });
      }
    });
  }

  /**
   * Get the actual connection state of a hub
   */
  public getHubConnectionState(hubName: string): HubConnectionState | null {
    const connection = this.connections.get(hubName);
    return connection ? connection.state : null;
  }

  /**
   * Check if a hub is currently connected
   */
  public isHubConnected(hubName: string): boolean {
    const connection = this.connections.get(hubName);
    return connection?.state === HubConnectionState.Connected;
  }

  /**
   * Get the number of registered event listeners for a specific event
   * Useful for debugging memory leaks
   */
  public getEventListenerCount(event: string): number {
    return this.eventListeners.get(event)?.size ?? 0;
  }

  /**
   * Get total number of all event listeners
   * Useful for debugging memory leaks
   */
  public getTotalEventListenerCount(): number {
    let total = 0;
    this.eventListeners.forEach((listeners) => {
      total += listeners.size;
    });
    return total;
  }

  /**
   * Check if page is visible (web platform only)
   */
  public isVisible(): boolean {
    return this.isPageVisible;
  }
}

export const signalRService = SignalRService.getInstance();
export { SignalRService };
