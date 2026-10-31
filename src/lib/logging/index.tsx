import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { consoleTransport, logger as rnLogger } from 'react-native-logs';

import type { LogContext, LogEntry, Logger, LogLevel } from './types';

// Substring match: any context key CONTAINING one of these fragments is redacted.
// This catches camelCase/snake_case variants (accessToken, refresh_token, id_token, ...)
// without having to enumerate every possible spelling.
const SENSITIVE_KEY_PARTS = ['token', 'password', 'passwd', 'secret', 'apikey', 'api_key', 'authorization', 'cred', 'email', 'ssn', 'saml', 'cookie', 'session', 'username', 'grant'];

// Exact-match keys too short to match as fragments without redacting unrelated words (author, authority).
const SENSITIVE_EXACT_KEYS = new Set(['auth']);

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_EXACT_KEYS.has(lower) || SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
};

// Strip query string and hash — URLs can carry credentials (e.g. access_token params).
const sanitizeUrl = (url: unknown): string | undefined => {
  if (typeof url !== 'string' || url.length === 0) return undefined;
  return url.split('?')[0].split('#')[0];
};

interface AxiosErrorLike {
  isAxiosError?: boolean;
  name?: string;
  message?: string;
  code?: string;
  config?: { method?: string; url?: string; baseURL?: string };
  response?: { status?: number };
}

// Axios errors carry the full request (incl. urlencoded password/token bodies in
// config.data) and response objects with circular refs. Never forward them raw —
// reduce to a safe summary instead.
const isAxiosErrorLike = (value: unknown): value is AxiosErrorLike => typeof value === 'object' && value !== null && ((value as AxiosErrorLike).isAxiosError === true || ('config' in value && 'message' in value));

const summarizeAxiosError = (error: AxiosErrorLike): Record<string, unknown> => ({
  name: error.name,
  message: error.message,
  code: error.code,
  status: error.response?.status,
  method: error.config?.method,
  url: sanitizeUrl(error.config?.url),
  baseURL: sanitizeUrl(error.config?.baseURL),
  isAxiosError: true,
});

const sanitizeValue = (key: string, value: unknown, depth: number): unknown => {
  if (isSensitiveKey(key)) return '[REDACTED]';
  if (isAxiosErrorLike(value)) return summarizeAxiosError(value);
  // Error instances have non-enumerable props; Object.keys() would yield {}.
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth > 0 && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>, depth - 1);
  }
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  return value;
};

const sanitizeObject = (obj: Record<string, unknown>, depth: number): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeValue(key, obj[key], depth);
  }
  return result;
};

export const sanitizeLogContext = (context: LogContext | undefined): LogContext => {
  if (!context) return {};
  return sanitizeObject(context as Record<string, unknown>, 2);
};

/**
 * Rebuilds a bare Error carrying only name/message/stack so Sentry groups the
 * issue by the real exception and shows the originating frames.
 *
 * The original is never handed to Sentry directly: `captureException` serializes
 * an error's own enumerable properties into the event, which for an AxiosError
 * means `config.data` — the urlencoded password/token bodies `summarizeAxiosError`
 * exists to strip. Copying three fields keeps the grouping win without the leak.
 */
const toCaptureableError = (value: unknown): Error | null => {
  if (!(value instanceof Error)) return null;
  const stripped = new Error(value.message);
  stripped.name = value.name;
  stripped.stack = value.stack;
  return stripped;
};

// On web, async: true wraps every log call in setTimeout which — combined with
// Sentry's setTimeout instrumentation — creates unbounded memory growth.
// Setting async: false on web prevents this. Severity stays 'debug' in dev
// on all platforms so console output is visible for debugging.
const isWeb = Platform.OS === 'web';
const isJest = typeof process !== 'undefined' && typeof process.env?.JEST_WORKER_ID !== 'undefined';

const config = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  severity: __DEV__ ? 'debug' : 'warn',
  transport: consoleTransport,
  transportOptions: {
    colors: {
      debug: 'gray',
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
    },
  },
  async: !isWeb && !isJest,
  dateFormat: 'time',
  printLevel: true,
  printDate: true,
  fixedExtLvlLength: false,
  enabled: !isJest,
};

const LEVEL_VALUES: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_SEVERITY: number = LEVEL_VALUES[(config.severity as LogLevel) ?? 'warn'] ?? 2;

class LogService {
  private static instance: LogService;
  private logger: any;
  private globalContext: Record<string, unknown> = {};

  private constructor() {
    this.logger = rnLogger.createLogger(config as any);
  }

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  private log(level: LogLevel, { message, operation, trace_id, context = {} }: LogEntry): void {
    // Bail before allocating the context object on hot paths (SignalR messages,
    // GPS fixes) when the level would be filtered out anyway.
    if (isJest || LEVEL_VALUES[level] < MIN_SEVERITY) return;
    // Redacted here, before the console transport, not only on the Sentry path: release builds still print warn and
    // error to logcat and the Xcode console, and a raw AxiosError serializes its urlencoded password body there.
    this.logger[level](message, {
      ...sanitizeLogContext({ ...this.globalContext, ...context }),
      ...(operation ? { operation } : {}),
      ...(trace_id ? { trace_id } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  public setGlobalContext(context: Record<string, unknown>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  public clearGlobalContext(): void {
    this.globalContext = {};
  }

  public debug(entry: LogEntry): void {
    this.log('debug', entry);
  }

  public info(entry: LogEntry): void {
    this.log('info', entry);
  }

  public warn(entry: LogEntry): void {
    this.log('warn', entry);
  }

  public error(entry: LogEntry): void {
    this.log('error', entry);
    if (!isJest) {
      // Read the error BEFORE sanitizing: sanitizeLogContext replaces every
      // Error with a plain object, so testing the sanitized value for
      // `instanceof Error` never matched and every logger.error was reported as
      // a message fingerprinted on LogService#error — no exception type and no
      // originating stack on any issue in the project.
      const rawError = entry.context?.error;
      const sanitized = sanitizeLogContext({
        ...entry.context,
        ...(entry.operation ? { operation: entry.operation } : {}),
        ...(entry.trace_id ? { trace_id: entry.trace_id } : {}),
      });
      const captureable = toCaptureableError(rawError);
      if (captureable) {
        Sentry.captureException(captureable, { extra: { message: entry.message, ...sanitized } });
      } else {
        Sentry.captureMessage(entry.message, { level: 'error', extra: sanitized });
      }
    }
  }
}

// Export singleton instance
export const logger = LogService.getInstance();

// React hook for component usage
export const useLogger = (): Logger => {
  return {
    debug: (entry: LogEntry) => logger.debug(entry),
    info: (entry: LogEntry) => logger.info(entry),
    warn: (entry: LogEntry) => logger.warn(entry),
    error: (entry: LogEntry) => logger.error(entry),
  };
};
