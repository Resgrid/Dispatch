/**
 * Where the API client finds the current Protected Data Grant header.
 *
 * A module of its own on purpose. The client cannot import the data-protection store (the store's
 * own API layer is built on the client, so that is a cycle), and the store must not import the
 * client either — doing so drags the whole HTTP stack into the module graph of every screen that
 * shows a protected value, which breaks unrelated tests and slows unrelated startups. Both sides
 * depend on this instead, and it depends on nothing.
 */
type GrantHeaderProvider = () => Record<string, string>;

let provider: GrantHeaderProvider | null = null;

/** Registered by the data-protection store at module load. */
export const setProtectedGrantProvider = (next: GrantHeaderProvider | null) => {
  provider = next;
};

/**
 * The grant header, or an empty object when no grant is held or the provider throws. Never throws:
 * a request must still go out, it simply comes back with protected values redacted.
 */
export const readProtectedGrantHeaders = (): Record<string, string> => {
  if (!provider) {
    return {};
  }

  try {
    return provider();
  } catch {
    return {};
  }
};
