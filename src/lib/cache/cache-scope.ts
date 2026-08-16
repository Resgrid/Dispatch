import { storage } from '@/lib/storage';

/**
 * Identity the API cache is scoped to.
 *
 * Cache keys used to be built from the server URL and endpoint alone. On a shared device that meant
 * signing out and signing back in as someone else served the previous account's units, personnel and
 * contacts straight out of MMKV, and a user moving between departments kept the old department's
 * data. Both are fixed by making the identity part of the key.
 *
 * This lives in its own leaf module (storage is its only import) so the api client can read it
 * without importing the auth store, which imports the api client.
 */
export interface CacheScope {
  userId: string | null;
  departmentId: string | null;
}

const CACHE_SCOPE_KEY = 'api_cache_scope';

let cachedScope: CacheScope | null = null;

const readScope = (): CacheScope => {
  if (cachedScope) {
    return cachedScope;
  }

  try {
    const raw = storage.getString(CACHE_SCOPE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CacheScope>;
      cachedScope = {
        userId: typeof parsed.userId === 'string' ? parsed.userId : null,
        departmentId: typeof parsed.departmentId === 'string' ? parsed.departmentId : null,
      };
      return cachedScope;
    }
  } catch {
    // A corrupt scope must not break every cached request; fall through to anonymous.
  }

  cachedScope = { userId: null, departmentId: null };
  return cachedScope;
};

export const getCacheScope = (): CacheScope => readScope();

/**
 * Records who the cache belongs to. Call on login and whenever the department is resolved or
 * changed. Values are merged, so learning the department later does not erase the user.
 */
export const setCacheScope = (scope: Partial<CacheScope>): void => {
  const current = readScope();
  const next: CacheScope = {
    userId: scope.userId !== undefined ? scope.userId : current.userId,
    departmentId: scope.departmentId !== undefined ? scope.departmentId : current.departmentId,
  };

  cachedScope = next;

  try {
    storage.set(CACHE_SCOPE_KEY, JSON.stringify(next));
  } catch {
    // In-memory scope is still correct for this session.
  }
};

export const clearCacheScope = (): void => {
  cachedScope = { userId: null, departmentId: null };

  try {
    storage.delete(CACHE_SCOPE_KEY);
  } catch {
    // Nothing to do — the in-memory scope is already reset.
  }
};

/** Key fragment identifying the current scope. */
export const getCacheScopeKey = (): string => {
  const scope = readScope();
  return `${scope.departmentId ?? 'nodept'}_${scope.userId ?? 'anon'}`;
};
