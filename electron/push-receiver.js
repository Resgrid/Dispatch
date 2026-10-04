/**
 * Desktop push. Electron's Chromium has no browser push service, so the web edition's service worker can't
 * receive anything here. Instead this main process holds its own FCM connection (@eneris/push-receiver
 * registers the way Chrome does, against the same Firebase web app the browsers use), and the page
 * registers the token it hands back with Core exactly like a browser token (Platform 3).
 *
 * Pushes arrive while the app is running, including with its window hidden or minimized. A push for a
 * window the person is looking at goes to the page for its in-app alert; any other becomes a native
 * notification, and clicking that brings the window forward and hands the push to the page.
 *
 * The receiver's credentials (its FCM token and the keys that decrypt pushes) are kept in the user data
 * folder so the token survives restarts. Forgetting them is how sign-out kills the token on this device.
 */
const fs = require('fs');
const path = require('path');

/** FCM persistent ids already delivered; sent back at login so the server doesn't deliver them again. */
const MAX_PERSISTENT_IDS = 100;

const FIREBASE_FIELDS = ['apiKey', 'projectId', 'messagingSenderId', 'appId', 'vapidKey'];

function isFirebaseConfig(value) {
    return !!value && typeof value === 'object' && FIREBASE_FIELDS.every((field) => typeof value[field] === 'string' && value[field].length > 0);
}

function configKey(firebase) {
    return [firebase.projectId, firebase.appId, firebase.messagingSenderId, firebase.vapidKey].join('|');
}

/** What a page or notification needs from one FCM message (the fields Core's webpush block carries). */
function toPayload(message, defaultTitle) {
    const notification = (message && message.notification) || {};
    const data = (message && message.data) || {};
    const text = (value) => (typeof value === 'string' ? value : '');

    return {
        title: text(data.title) || text(notification.title) || defaultTitle,
        body: text(data.message) || text(notification.body) || text(data.body),
        eventCode: text(data.eventCode),
        type: text(data.type),
        category: text(data.category),
    };
}

function chromePlatform(platform) {
    if (platform === 'win32') return 1;
    if (platform === 'darwin') return 2;
    return 3;
}

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {{
 *   storePath: string,
 *   appName: string,
 *   platform?: string,
 *   createReceiver?: (config: object) => any,
 *   notify: (payload: object, onClick: () => void) => boolean,
 *   isWindowFocused: () => boolean,
 *   send: (channel: string, payload: object) => boolean,
 *   focus: () => void,
 *   log?: { warn: Function },
 * }} options
 */
function registerPushReceiver(ipcMain, options) {
    const createReceiver =
        options.createReceiver ||
        ((config) => {
            const { PushReceiver } = require('@eneris/push-receiver');
            return new PushReceiver(config);
        });
    const log = options.log || console;

    let receiver = null;
    let receiverKey = null;
    let starting = null;
    let pendingClick = null;

    function load() {
        try {
            return JSON.parse(fs.readFileSync(options.storePath, 'utf8')) || {};
        } catch {
            return {};
        }
    }

    function save(state) {
        try {
            fs.mkdirSync(path.dirname(options.storePath), { recursive: true });
            // The credentials decrypt this device's pushes: readable by this user only.
            fs.writeFileSync(options.storePath, JSON.stringify(state), { mode: 0o600 });
        } catch (error) {
            log.warn('Desktop push: could not save the receiver state', error);
        }
    }

    function forget() {
        try {
            fs.rmSync(options.storePath, { force: true });
        } catch (error) {
            log.warn('Desktop push: could not remove the receiver state', error);
        }
    }

    function rememberPersistentId(persistentId) {
        if (!persistentId) return;
        const state = load();
        const ids = Array.isArray(state.persistentIds) ? state.persistentIds : [];
        if (!ids.includes(persistentId)) {
            ids.push(persistentId);
        }
        save({ ...state, persistentIds: ids.slice(-MAX_PERSISTENT_IDS) });
    }

    function deliverClick(payload) {
        options.focus();
        if (!options.send('push:notification-click', payload)) {
            // No page to take it yet (the window was closed, or is still loading): it asks when it starts.
            pendingClick = payload;
        }
    }

    function handleMessage(envelope) {
        rememberPersistentId(envelope && envelope.persistentId);
        const payload = toPayload(envelope && envelope.message, options.appName);

        if (options.isWindowFocused() && options.send('push:received', payload)) {
            return;
        }

        options.notify(payload, () => deliverClick(payload));
    }

    function stop(shouldForget) {
        if (receiver) {
            try {
                receiver.destroy();
            } catch (error) {
                log.warn('Desktop push: the receiver did not stop cleanly', error);
            }
        }

        receiver = null;
        receiverKey = null;
        starting = null;

        if (shouldForget) {
            forget();
        }
    }

    async function start(firebase) {
        const key = configKey(firebase);
        if (receiver && receiverKey === key && receiver.fcmToken) {
            return receiver.fcmToken;
        }

        stop(false);

        const state = load();
        // Credentials minted for another Firebase app or key can't receive this one's pushes.
        const credentials = state.configKey === key ? state.credentials : undefined;

        const instance = createReceiver({
            firebase: { apiKey: firebase.apiKey, appId: firebase.appId, projectId: firebase.projectId, messagingSenderId: firebase.messagingSenderId },
            vapidKey: firebase.vapidKey,
            credentials,
            persistentIds: Array.isArray(state.persistentIds) ? state.persistentIds : [],
            chromePlatform: chromePlatform(options.platform || process.platform),
        });

        instance.onCredentialsChanged(({ newCredentials }) => {
            save({ ...load(), configKey: key, credentials: newCredentials, persistentIds: [] });
        });
        instance.onNotification(handleMessage);

        receiver = instance;
        receiverKey = key;

        // The token exists once registration is done; the connection that delivers pushes can come up after
        // (and keeps retrying on its own), so the page can register without waiting on it.
        await instance.registerIfNeeded();
        instance.connect().catch((error) => log.warn('Desktop push: connection failed', error));

        return instance.fcmToken;
    }

    ipcMain.handle('push:start', async (_event, firebase) => {
        if (!isFirebaseConfig(firebase)) {
            return { error: 'invalid-config' };
        }

        if (!starting) {
            starting = start(firebase).finally(() => {
                starting = null;
            });
        }

        try {
            const token = await starting;
            return token ? { token } : { error: 'no-token' };
        } catch (error) {
            stop(false);
            log.warn('Desktop push: could not register with FCM', error);
            return { error: (error && error.message) || 'register-failed' };
        }
    });

    ipcMain.handle('push:stop', async (_event, shouldForget) => {
        stop(!!shouldForget);
    });

    ipcMain.handle('push:take-pending-click', () => {
        const payload = pendingClick;
        pendingClick = null;
        return payload;
    });

    return {
        stop: () => stop(false),
    };
}

module.exports = { registerPushReceiver, toPayload, isFirebaseConfig };
