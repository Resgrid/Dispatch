import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { isSharedInstallation } from '@/lib/mfa/shared-installation';
import { checkSharedSession, lockSharedSession, POLL_INTERVAL_MS, reportOperatorActivity, stopRealtime } from '@/lib/shared-session/controller';
import { consumeSessionRestoredAtLaunch, useSharedSessionStore } from '@/stores/shared-session/store';

import { useAppLifecycle } from './use-app-lifecycle';

const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

/**
 * Keeps a shared session honest (passkey plan section 10.5): asks the server at sign-in whether the session is
 * shared, locks one restored at launch or sent to the background, polls its status every minute and at the idle and
 * shift deadlines, reports real operator input, and stops the realtime hubs while locked. Returns the touch handler the
 * app shell puts on its root view.
 */
export function useSharedSessionLifecycle(isSignedIn: boolean) {
  const shared = useSharedSessionStore((s) => s.shared);
  const locked = useSharedSessionStore((s) => s.locked);
  const { appState } = useAppLifecycle();

  // At sign-in (or a restored session): does the server run this session as shared? A restored shared session locks now.
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const restored = consumeSessionRestoredAtLaunch();
      if (restored && isSharedInstallation()) {
        // Concealed from the first frame (the auth store locked it at restore); the lock screen locks the server
        // session before any unlock, and a personal session it finds there is let go.
        await lockSharedSession('restart');
        return;
      }
      const current = await checkSharedSession();
      if (cancelled || !restored) {
        return;
      }
      // A session the department made shared, restored on an installation that is not marked shared.
      if (current?.Shared && !current.Locked) {
        await lockSharedSession('restart');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Put away (home button, another app, screen off): a shared device locks. Web and desktop follow the idle lock.
  useEffect(() => {
    if (!isSignedIn || !shared || locked || Platform.OS === 'web') {
      return;
    }
    if (appState === 'background') {
      void lockSharedSession('background');
    }
  }, [appState, isSignedIn, shared, locked]);

  // Locked from anywhere (a 401, a refused refresh, the Lock button): the hubs stop until the unlock.
  useEffect(() => {
    if (isSignedIn && locked) {
      void stopRealtime();
    }
  }, [isSignedIn, locked]);

  // Follow the server: every minute, and each second once the idle lock or the shift end is due. Never as activity.
  useEffect(() => {
    if (!isSignedIn || !shared || locked) {
      return;
    }
    const timer = setInterval(() => {
      const state = useSharedSessionStore.getState();
      const now = Date.now();
      const due = (state.idleLocksAt !== null && now >= state.idleLocksAt) || (state.shiftEndsAt !== null && now >= state.shiftEndsAt);
      const sinceCheck = state.checkedAt === null ? Number.POSITIVE_INFINITY : now - state.checkedAt;
      if ((due && sinceCheck >= 1000) || sinceCheck >= POLL_INTERVAL_MS) {
        void checkSharedSession(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isSignedIn, shared, locked]);

  // Web and desktop: keys, pointer, wheel and touch anywhere count as the operator being there.
  useEffect(() => {
    if (Platform.OS !== 'web' || !isSignedIn || !shared || locked || typeof document === 'undefined') {
      return;
    }
    const onInput = () => reportOperatorActivity();
    for (const name of INPUT_EVENTS) {
      document.addEventListener(name, onInput, { capture: true, passive: true });
    }
    return () => {
      for (const name of INPUT_EVENTS) {
        document.removeEventListener(name, onInput, { capture: true });
      }
    };
  }, [isSignedIn, shared, locked]);

  // Native: every touch on the app shell passes through here first (and is never claimed).
  const onTouchCapture = useCallback(() => {
    reportOperatorActivity();
    return false;
  }, []);

  return { onTouchCapture, locked: isSignedIn && locked, shared: isSignedIn && shared };
}
