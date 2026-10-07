import { isAxiosError } from 'axios';

/** Anything longer than this is not a reason written for a person (a stack trace, an error page). */
const MAX_SERVER_MESSAGE_LENGTH = 500;

/**
 * The server answered a call close with a refusal that sending it again cannot change: a 4xx other than a
 * timeout or rate limit, e.g. 400 "This call has an active incident command".
 */
export const isCallCloseRejection = (error: unknown): boolean => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
};

/**
 * The reason the server gave for refusing a call close, when it gave one. The v4 controller answers a refused
 * close with a plain-text 400 body (for example "This call has an active incident command. Close the incident
 * command first, then close the call."); a JSON body's Message/detail/title is accepted too. Returns null for
 * network and server (5xx) failures, empty bodies and HTML error pages, so callers fall back to their own text.
 */
export const getCallCloseErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error) || !isCallCloseRejection(error)) {
    return null;
  }

  const data: unknown = error.response?.data;
  let text: unknown = data;
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    text = body.Message ?? body.message ?? body.detail ?? body.title;
  }

  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<') || trimmed.length > MAX_SERVER_MESSAGE_LENGTH) {
    return null;
  }
  return trimmed;
};
