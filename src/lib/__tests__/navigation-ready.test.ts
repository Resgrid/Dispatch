import { router } from 'expo-router';

import { isNavigationReady, registerNavigationReadyCheck, routerPushWithRetry } from '../navigation';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('../logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * expo-router's `router.push` does not throw when the root layout has not mounted — it
 * warns and discards the navigation. The original retry loop only retried inside a
 * `catch`, so it never retried at all and cold-start deep links landed on the home
 * screen. These tests pin the readiness gate that replaced it.
 */
describe('navigation readiness gate', () => {
  const push = router.push as jest.Mock;
  const href = { pathname: '/chat/[channelId]', params: { channelId: 'abc' } } as never;

  beforeEach(() => {
    jest.useFakeTimers();
    push.mockReset();
    push.mockImplementation(() => undefined);
    registerNavigationReadyCheck(null);
  });

  afterEach(() => {
    registerNavigationReadyCheck(null);
    jest.useRealTimers();
  });

  it('reports ready when nothing has registered a check', () => {
    expect(isNavigationReady()).toBe(true);
  });

  it('reflects the registered check', () => {
    let ready = false;
    registerNavigationReadyCheck(() => ready);

    expect(isNavigationReady()).toBe(false);

    ready = true;
    expect(isNavigationReady()).toBe(true);
  });

  it('does not push while the navigation container is not ready', async () => {
    registerNavigationReadyCheck(() => false);

    const pending = routerPushWithRetry(href, { maxAttempts: 3, retryDelayMs: 250 }).catch(() => 'rejected');

    await jest.advanceTimersByTimeAsync(250 * 3);

    await expect(pending).resolves.toBe('rejected');
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes as soon as the container becomes ready', async () => {
    let ready = false;
    registerNavigationReadyCheck(() => ready);

    const pending = routerPushWithRetry(href, { maxAttempts: 20, retryDelayMs: 250 });

    // Silent no-op window: the old implementation gave up here having pushed nothing.
    await jest.advanceTimersByTimeAsync(500);
    expect(push).not.toHaveBeenCalled();

    ready = true;
    await jest.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(href);
  });

  it('holds the push until the waitUntil gate opens', async () => {
    let signedIn = false;
    const pending = routerPushWithRetry(href, { maxAttempts: 20, retryDelayMs: 250, waitUntil: () => signedIn });

    await jest.advanceTimersByTimeAsync(1000);
    expect(push).not.toHaveBeenCalled();

    signedIn = true;
    await jest.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing gate as not-ready and surfaces one error', async () => {
    const pending = routerPushWithRetry(href, {
      maxAttempts: 2,
      retryDelayMs: 250,
      waitUntil: () => {
        throw new Error('auth store unavailable');
      },
    });

    const settled = pending.catch((error: Error) => error.message);
    await jest.advanceTimersByTimeAsync(250 * 2);

    await expect(settled).resolves.toBe('auth store unavailable');
    expect(push).not.toHaveBeenCalled();
  });

  it('still retries a router that throws once ready', async () => {
    push
      .mockImplementationOnce(() => {
        throw new Error('router not ready');
      })
      .mockImplementationOnce(() => undefined);

    const pending = routerPushWithRetry(href, { maxAttempts: 5, retryDelayMs: 250 });

    await jest.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledTimes(2);
  });
});
