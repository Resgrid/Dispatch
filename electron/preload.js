// preload.js
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require('electron');

// ── Expose Electron platform flag ──────────────────────────────────────
// The renderer can use `window.__ELECTRON__` to detect if it is running
// inside Electron (as opposed to a regular browser).
contextBridge.exposeInMainWorld('__ELECTRON__', true);

// ── Expose notification bridge ─────────────────────────────────────────
// Provides a safe bridge for the renderer to trigger native OS
// notifications via the main process (macOS, Windows, Linux).
const notificationCallbacks = [];

contextBridge.exposeInMainWorld('electronNotifications', {
    /**
     * Show a native OS notification via the Electron main process.
     * @param {{ title: string, body: string, eventCode?: string, data?: object }} payload
     * @returns {Promise<boolean>} true if the notification was shown
     */
    show: (payload) => ipcRenderer.invoke('notifications:show', payload),

    /**
     * Check whether native notifications are supported on this platform.
     * @returns {Promise<boolean>}
     */
    isSupported: () => ipcRenderer.invoke('notifications:isSupported'),

    /**
     * Register a callback that fires when the main process sends a
     * notification payload to the renderer (e.g. from a backend push
     * channel handled in the main process).
     * @param {(payload: object) => void} callback
     */
    onNotification: (callback) => {
        notificationCallbacks.push(callback);
    },
});

// Forward notifications pushed from main → renderer
ipcRenderer.on('notification:push', (_event, payload) => {
    for (const cb of notificationCallbacks) {
        try {
            cb(payload);
        } catch (err) {
            console.error('Error in notification callback:', err);
        }
    }
});

// ── Expose deep-link bridge ────────────────────────────────────────────
// Lets the renderer subscribe to deep-link URLs (resgriddispatch://...)
// forwarded by the main process from second-instance / open-url events.
contextBridge.exposeInMainWorld('electronDeepLinks', {
    /**
     * Register a callback that fires when the main process forwards a
     * deep-link URL to the renderer.
     * @param {(url: string) => void} callback
     * @returns {() => void} unsubscribe function that removes the listener
     */
    onDeepLink: (callback) => {
        const handler = (_event, deepLinkUrl) => {
            try {
                callback(deepLinkUrl);
            } catch (err) {
                console.error('Error in deep-link callback:', err);
            }
        };
        ipcRenderer.on('deep-link', handler);
        return () => ipcRenderer.removeListener('deep-link', handler);
    },
});

// ── Version information (original preload logic) ───────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }
})
