/** The HTTP response an error carries, read by shape so any HTTP error (not only an AxiosError instance) is understood. */
const responseOf = (error: unknown): { status?: number; data?: unknown } | undefined => {
  const response = (error as { response?: unknown } | null | undefined)?.response;
  return typeof response === 'object' && response !== null ? (response as { status?: number; data?: unknown }) : undefined;
};

/**
 * A refresh refused because the shared session is locked (passkey workbook section 1.3): `invalid_grant` with
 * `shared_session_locked: true`. Not a sign-out: the tokens stay, the lock screen unlocks the same session, and the
 * refresh runs again afterwards.
 */
export const isSharedSessionLockedRefresh = (error: unknown): boolean => {
  const response = responseOf(error);
  if (response?.status !== 400) {
    return false;
  }
  const body = response.data as { shared_session_locked?: unknown } | undefined;
  return typeof body === 'object' && body !== null && body.shared_session_locked === true;
};

/** What a 401 from the API said about a shared session: locked (unlock it), expired (the shift ran out), or neither. */
export type SharedSession401 = { kind: 'locked'; lockVersion: number | null } | { kind: 'expired' } | null;

export const sharedSession401 = (error: unknown): SharedSession401 => {
  const response = responseOf(error);
  if (response?.status !== 401) {
    return null;
  }
  const body = response.data as { error?: unknown; lock_version?: unknown } | undefined;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (body.error === 'shared_session_locked') {
    return { kind: 'locked', lockVersion: typeof body.lock_version === 'number' ? body.lock_version : null };
  }
  if (body.error === 'shared_session_expired') {
    return { kind: 'expired' };
  }
  return null;
};
