/* eslint-disable no-undef */
/**
 * Service worker for Resgrid Dispatch web push.
 *
 * The page mints its FCM web token against this registration (services/web-push.web.ts), but
 * Firebase is not loaded here: every push is shown below. Core sends the fields in the FCM webpush
 * block (NovuProvider.SendNotification): data carries title, message, eventCode, type and category.
 *
 * The app does the routing. A click focuses an open window and posts NOTIFICATION_CLICK to it; with no
 * window open, the new one is handed the push after it says CLIENT_READY. Every push is also posted as
 * PUSH_RECEIVED so a window the person is looking at can show its in-app alert.
 */

const DEFAULT_TITLE = 'Resgrid Dispatch';

// Clicks waiting for the window they opened to finish loading, by client id.
const pendingClicks = new Map();

function readPush(event) {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json() || {};
    } catch (e) {
      payload = { notification: { body: event.data.text() } };
    }
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  return {
    title: data.title || notification.title || payload.title || DEFAULT_TITLE,
    body: data.message || notification.body || data.body || payload.body || payload.message || '',
    eventCode: data.eventCode || payload.eventCode || '',
    type: data.type || '',
    category: data.category || '',
  };
}

function isCall(push) {
  return push.category === 'calls' || /^c(?!t)/i.test(push.eventCode);
}

self.addEventListener('push', (event) => {
  const push = readPush(event);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(push.title, {
        body: push.body,
        icon: '/favicon.ico',
        tag: push.eventCode || undefined,
        renotify: !!push.eventCode,
        requireInteraction: isCall(push),
        data: push,
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        windows.forEach((client) => client.postMessage({ type: 'PUSH_RECEIVED', data: push }));
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const client = windows.find((candidate) => 'focus' in candidate);
      if (client) {
        return client.focus().then((focused) => (focused || client).postMessage({ type: 'NOTIFICATION_CLICK', data }));
      }

      if (!self.clients.openWindow) {
        return undefined;
      }

      return self.clients.openWindow('/').then((opened) => {
        if (opened) {
          pendingClicks.set(opened.id, data);
        }
      });
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (!event.data || !event.source) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // A window this worker opened has loaded: hand it the click that opened it.
  if (event.data.type === 'CLIENT_READY' && pendingClicks.has(event.source.id)) {
    const data = pendingClicks.get(event.source.id);
    pendingClicks.delete(event.source.id);
    event.source.postMessage({ type: 'NOTIFICATION_CLICK', data });
  }
});
