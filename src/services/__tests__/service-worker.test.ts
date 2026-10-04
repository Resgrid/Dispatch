/**
 * The web push service worker (public/service-worker.js), run in a vm with a stand-in `self`. It shows every push from
 * the fields Core's webpush block carries, tells open windows about it, and hands a click to an open window, or to the
 * window it opens once that window says it is ready.
 *
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(path.resolve(__dirname, '../../../public/service-worker.js'), 'utf8');

interface FakeClient {
  id: string;
  posted: unknown[];
  focus: () => Promise<FakeClient>;
  postMessage: (message: unknown) => void;
}

function client(id: string): FakeClient {
  const fake: FakeClient = {
    id,
    posted: [],
    focus: async () => fake,
    postMessage: (message) => fake.posted.push(message),
  };
  return fake;
}

function loadWorker(windows: FakeClient[] = []) {
  const listeners: Record<string, (event: any) => void> = {};
  const shown: { title: string; options: any }[] = [];
  const opened: string[] = [];
  const openedClient = client('new-window');

  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    },
    skipWaiting: () => Promise.resolve(),
    registration: {
      showNotification: async (title: string, options: unknown) => {
        shown.push({ title, options });
      },
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows,
      openWindow: async (url: string) => {
        opened.push(url);
        return openedClient;
      },
    },
  };

  vm.runInNewContext(source, { self, Map, console });

  const dispatch = async (type: string, event: object) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]({ ...event, waitUntil: (promise: Promise<unknown>) => (pending = promise) });
    await pending;
  };

  return {
    shown,
    opened,
    openedClient,
    push: (payload: unknown) => dispatch('push', { data: payload === undefined ? null : { json: () => payload, text: () => JSON.stringify(payload) } }),
    click: (data: unknown) => dispatch('notificationclick', { notification: { data, close: () => undefined } }),
    message: (data: unknown, from: FakeClient) => listeners.message({ data, source: from }),
  };
}

const fcmPush = (eventCode: string, category: string) => ({
  from: '343968022249',
  notification: { title: 'Structure Fire', body: '123 Main St' },
  data: { title: 'Structure Fire', message: '123 Main St', eventCode, type: '3', category },
});

describe('service worker', () => {
  it('shows a call push that stays up until dealt with, and tells open windows', async () => {
    const open = client('tab');
    const worker = loadWorker([open]);

    await worker.push(fcmPush('C1234', 'calls'));

    expect(worker.shown).toHaveLength(1);
    expect(worker.shown[0].title).toBe('Structure Fire');
    expect(worker.shown[0].options).toMatchObject({ body: '123 Main St', tag: 'C1234', requireInteraction: true, renotify: true });
    expect(open.posted).toEqual([{ type: 'PUSH_RECEIVED', data: { title: 'Structure Fire', body: '123 Main St', eventCode: 'C1234', type: '3', category: 'calls' } }]);
  });

  it('lets other pushes close on their own, and never shows an empty one', async () => {
    const worker = loadWorker();

    await worker.push(fcmPush('M:5', 'messages'));
    await worker.push(undefined);

    expect(worker.shown[0].options.requireInteraction).toBe(false);
    expect(worker.shown[1].title).toBe('Resgrid Dispatch');
  });

  it('hands a click to an open window', async () => {
    const open = client('tab');
    const worker = loadWorker([open]);

    await worker.click({ eventCode: 'C:9' });

    expect(open.posted).toEqual([{ type: 'NOTIFICATION_CLICK', data: { eventCode: 'C:9' } }]);
    expect(worker.opened).toEqual([]);
  });

  it('opens the app when no window is open, and hands it the click once it is ready', async () => {
    const worker = loadWorker();

    await worker.click({ eventCode: 'C:9' });
    expect(worker.opened).toEqual(['/']);

    worker.message({ type: 'CLIENT_READY' }, client('someone-else'));
    expect(worker.openedClient.posted).toEqual([]);

    worker.message({ type: 'CLIENT_READY' }, worker.openedClient);
    worker.message({ type: 'CLIENT_READY' }, worker.openedClient);
    expect(worker.openedClient.posted).toEqual([{ type: 'NOTIFICATION_CLICK', data: { eventCode: 'C:9' } }]);
  });
});
