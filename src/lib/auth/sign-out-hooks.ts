/**
 * Work that has to reach the server as the signed-out session, before logout clears its access token:
 * taking this browser's or desktop's push token off the server, so the next person on the device never
 * sees the previous one's calls. A leaf module (zero imports) for the same reason as session-cleanup:
 * the hooks' owners import stores that import the auth store.
 *
 * A hook gets the token as it stood and must call the server directly, never through the api client:
 * the client's 401 handling calls logout, which is already running and would wait on the hook forever.
 */

export type SignOutHook = (accessToken: string | null) => Promise<void>;

/** Sign-out never waits longer than this on a slow or unreachable server. */
export const SIGN_OUT_HOOK_TIMEOUT_MS = 3000;

const hooks = new Set<SignOutHook>();

/** Returns a function that removes the hook. */
export const registerSignOutHook = (hook: SignOutHook): (() => void) => {
  hooks.add(hook);
  return () => {
    hooks.delete(hook);
  };
};

export const runSignOutHooks = async (accessToken: string | null): Promise<void> => {
  if (hooks.size === 0) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_HOOK_TIMEOUT_MS);
  });

  try {
    await Promise.race([Promise.allSettled([...hooks].map((hook) => hook(accessToken))), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/** Test hook. */
export const _clearSignOutHooks = (): void => {
  hooks.clear();
};
