const { app, BrowserWindow, protocol, net, Notification, ipcMain, session, shell, Menu } = require('electron');
const { registerSsoLoopback } = require('./sso-loopback');
const { registerLegacySso } = require('./legacy-sso');
const { registerPushReceiver } = require('./push-receiver');
const path = require('path');
const url = require('url');

// Use Electron's built-in app.isPackaged instead of electron-is-dev
// app.isPackaged is true when running from a packaged app, false during development
const isDev = !app.isPackaged;

// Register custom protocol scheme before app is ready.
// This allows serving local files with proper URL resolution so that
// absolute asset paths (e.g. /entry-xxx.js) resolve correctly instead of
// hitting the filesystem root when using file:// protocol.
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
]);

let mainWindow = null;
let pendingDeepLink = null;

// Windows shows a toast only for the AppUserModelID the installer registered, which electron-builder sets to the appId.
if (process.platform === 'win32') {
    app.setAppUserModelId('com.resgrid.dispatch');
}

// Deep-link scheme matching the app's linking scheme (env.js SCHEME).
// URL schemes are case-insensitive; argv/open-url matching is done lowercased.
const deepLinkScheme = 'ResgridDispatch';
const deepLinkPrefix = deepLinkScheme.toLowerCase() + '://';

if (process.defaultApp && process.argv.length >= 2) {
    // Unpackaged (electron .): the OS must start Electron with this app's entry script.
    app.setAsDefaultProtocolClient(deepLinkScheme, process.execPath, [path.resolve(process.argv[1])]);
} else {
    app.setAsDefaultProtocolClient(deepLinkScheme);
}

function forwardDeepLink(deepLinkUrl) {
    if (mainWindow && !mainWindow.webContents.isLoading()) {
        mainWindow.webContents.send('deep-link', deepLinkUrl);
    } else {
        pendingDeepLink = deepLinkUrl;
    }
}

function focusMainWindow() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
}

// Legacy SSO: the provider and the SAML relay return through the OS to resgriddispatch://auth/callback (legacy-sso.js).
// That link goes to the waiting sign-in, never to the page; other links are forwarded as before.
const legacySso = registerLegacySso(ipcMain, {
    scheme: deepLinkScheme,
    openExternal: (externalUrl) => shell.openExternal(externalUrl),
    // The main process's network stack: the system's proxy settings, and no Origin header on the provider's token request.
    fetch: (fetchUrl, init) => net.fetch(fetchUrl, init),
    focus: focusMainWindow,
});

// Desktop push (push-receiver.js): this process receives the dispatcher's pushes and shows them natively.
// Notifications are held until clicked or closed: one that is garbage collected loses its click handler.
const activePushNotifications = new Set();

const pushReceiver = registerPushReceiver(ipcMain, {
    storePath: path.join(app.getPath('userData'), 'push-receiver.json'),
    appName: 'Resgrid Dispatch',
    notify: (payload, onClick) => {
        if (!Notification.isSupported()) {
            return false;
        }

        const isCall = payload.category === 'calls';
        const notification = new Notification({
            title: payload.title,
            body: payload.body,
            silent: false,
            icon: path.join(__dirname, '../assets/icon.png'),
            urgency: isCall ? 'critical' : 'normal',
            timeoutType: isCall ? 'never' : 'default',
        });
        const release = () => activePushNotifications.delete(notification);
        activePushNotifications.add(notification);
        notification.on('click', () => {
            release();
            onClick();
        });
        notification.on('close', release);
        // Windows only: a notification the OS refused never clicks or closes.
        notification.on('failed', release);
        notification.show();
        return true;
    },
    isWindowFocused: () => !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused(),
    send: (channel, payload) => {
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) {
            return false;
        }
        mainWindow.webContents.send(channel, payload);
        return true;
    },
    focus: () => {
        if (mainWindow) {
            focusMainWindow();
        } else if (app.isReady()) {
            createWindow();
        }
    },
});

// Single-instance lock: required for the second-instance handler below to
// fire on Windows/Linux instead of spawning a duplicate process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        const deepLinkUrl = argv.find((arg) => arg.toLowerCase().startsWith(deepLinkPrefix));
        if (!mainWindow) {
            createWindow();
        } else {
            focusMainWindow();
        }
        if (deepLinkUrl && !legacySso.handleLink(deepLinkUrl)) {
            forwardDeepLink(deepLinkUrl);
        }
    });
}

// macOS deep links arrive via open-url instead of second-instance argv
app.on('open-url', (event, openUrl) => {
    event.preventDefault();
    if (!legacySso.handleLink(openUrl)) {
        forwardDeepLink(openUrl);
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Resgrid Dispatch',
        icon: path.join(__dirname, '../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
        },
    });

    // Prevent the HTML <title> tag from overriding the window title
    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Popups (incl. the OIDC/SSO flow) never create a new BrowserWindow.
    // Only http(s) targets are handed to the OS browser, everything else
    // is denied outright.
    mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        try {
            const parsed = new URL(targetUrl);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                shell.openExternal(targetUrl);
            }
        } catch (err) {
            console.error('Blocked invalid window.open URL:', targetUrl, err);
        }
        return { action: 'deny' };
    });

    // Block in-window navigation away from the app origin. Dev allows the
    // local Metro server only; production allows the app:// scheme only.
    mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
        let allowed = false;
        try {
            const parsed = new URL(targetUrl);
            allowed = isDev
                ? (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
                  (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
                : parsed.protocol === 'app:';
        } catch (err) {
            console.error('Blocked invalid navigation URL:', targetUrl, err);
        }
        if (!allowed) {
            event.preventDefault();
        }
    });

    // Flush any deep link queued before the renderer finished loading
    mainWindow.webContents.on('did-finish-load', () => {
        if (pendingDeepLink) {
            mainWindow.webContents.send('deep-link', pendingDeepLink);
            pendingDeepLink = null;
        }
    });

    // In development, load the local Expo web server
    // In production, load via custom app:// protocol that serves from dist/
    if (isDev) {
        console.log('Loading dev URL: http://localhost:8081');
        mainWindow.loadURL('http://localhost:8081');
        mainWindow.webContents.openDevTools();
    } else {
        console.log('Loading app://./index.html');
        mainWindow.loadURL('app://./index.html');
    }
}

app.whenReady().then(() => {
    // A second instance only hands its link to the first, then quits.
    if (!gotSingleInstanceLock) {
        return;
    }

    // ── Content Security Policy ───────────────────────────────────────
    // Set a proper CSP to silence the Electron security warning about
    // "unsafe-eval" / missing CSP.  In development we allow the local
    // dev-server origin; in production only the custom app:// scheme.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        let csp;
        if (isDev) {
            // Dev mode: Metro/webpack needs 'unsafe-eval' for source maps
            // and hot-reload, blob: for dynamic chunks, ws: for HMR.
            // Mapbox GL loads its stylesheet from api.mapbox.com and uses
            // blob: workers. connect-src allows plain http/ws for
            // self-hosted Resgrid servers without TLS.
            csp =
                "default-src 'self' http://localhost:8081;" +
                " script-src 'self' http://localhost:8081 'unsafe-inline' 'unsafe-eval' blob:;" +
                " style-src 'self' http://localhost:8081 'unsafe-inline' https://api.mapbox.com;" +
                " img-src 'self' http://localhost:8081 data: https: blob:;" +
                " font-src 'self' http://localhost:8081 data:;" +
                " connect-src 'self' http://localhost:8081 https: http: wss: ws:;" +
                " media-src 'self' http://localhost:8081 data: blob:;" +
                " worker-src 'self' blob:;" +
                " child-src blob:;";
        } else {
            csp =
                "default-src 'self' app:;" +
                " script-src 'self' app: 'unsafe-inline';" +
                " style-src 'self' app: 'unsafe-inline' https://api.mapbox.com;" +
                " img-src 'self' app: data: https: blob:;" +
                " font-src 'self' app: data:;" +
                " connect-src 'self' app: https: http: wss: ws:;" +
                " media-src 'self' app: data: blob:;" +
                " worker-src 'self' blob:;" +
                " child-src blob:;";
        }

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        });
    });
    // Register the custom app:// protocol handler for production builds.
    // This serves all files from the dist/ directory so that absolute asset
    // paths in the bundled HTML/JS/CSS resolve correctly.
    if (!isDev) {
        const distPath = path.join(__dirname, '../dist');
        protocol.handle('app', (request) => {
            const requestUrl = new URL(request.url);
            let filePath = decodeURIComponent(requestUrl.pathname);

            // Normalize the path: remove leading slashes/dots
            filePath = filePath.replace(/^\/+/, '');
            if (!filePath || filePath === '.' || filePath === './') {
                filePath = 'index.html';
            }

            // Reject backslashes outright (Windows separator bypass) and
            // verify the normalized/resolved path stays inside dist/ so
            // ../ segments cannot escape to arbitrary local files.
            if (filePath.includes('\\')) {
                return new Response('Forbidden', { status: 403 });
            }

            const resolvedPath = path.resolve(distPath, path.normalize(filePath));
            if (resolvedPath !== distPath && !resolvedPath.startsWith(distPath + path.sep)) {
                return new Response('Forbidden', { status: 403 });
            }

            return net.fetch(url.pathToFileURL(resolvedPath).toString());
        });
    }

    // Minimal application menu so copy/paste roles (and their keyboard
    // shortcuts, especially on macOS) work inside the window.
    const menuTemplate = [
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
        { role: 'editMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    createWindow();

    // ── Brokered SSO ───────────────────────────────────────────────────
    // The broker returns to a one-time loopback listener; the provider opens in the member's own browser.
    registerSsoLoopback(ipcMain, {
        openExternal: (url) => shell.openExternal(url),
        focus: focusMainWindow,
    });

    // ── Notification IPC handlers ──────────────────────────────────────
    // Allow the renderer to request native Electron Notification objects
    // which map to macOS Notification Center, Windows Toast & Linux
    // libnotify/notify-send automatically.

    ipcMain.handle('notifications:isSupported', () => {
        return Notification.isSupported();
    });

    ipcMain.handle('notifications:show', (_event, payload) => {
        if (!Notification.isSupported()) {
            console.warn('Native notifications are not supported on this platform');
            return false;
        }

        try {
            const notification = new Notification({
                title: payload.title || 'Resgrid Dispatch',
                body: payload.body || '',
                icon: path.join(__dirname, '../assets/icon.png'),
                silent: false,
            });

            notification.on('click', () => {
                // Focus / restore the main window when the notification is clicked
                const windows = BrowserWindow.getAllWindows();
                if (windows.length > 0) {
                    const win = windows[0];
                    if (win.isMinimized()) win.restore();
                    win.focus();
                }
            });

            notification.show();
            return true;
        } catch (err) {
            console.error('Failed to show native notification:', err);
            return false;
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Settings such as the selected server URL live in the renderer's localStorage, which
// Chromium writes to disk lazily. Flush it before exiting so a change made just before
// quitting survives the next launch.
app.on('before-quit', () => {
    pushReceiver.stop();
    try {
        session.defaultSession.flushStorageData();
    } catch (err) {
        console.error('Failed to flush storage data before quit:', err);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
