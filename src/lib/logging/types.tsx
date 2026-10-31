export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  message: string;
  operation?: string;
  trace_id?: string;
  context?: LogContext;
}

export interface Logger {
  debug: (entry: LogEntry) => void;
  info: (entry: LogEntry) => void;
  warn: (entry: LogEntry) => void;
  error: (entry: LogEntry) => void;
}
