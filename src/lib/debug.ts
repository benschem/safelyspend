/**
 * Debug logging utility for observability.
 * Provides structured logging with categories and an in-memory buffer.
 *
 * Enable debug mode via localStorage:
 *   localStorage.setItem('budget:debug', 'true')
 *
 * Or enable specific categories:
 *   localStorage.setItem('budget:debug', 'db,import')
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'db' | 'import' | 'storage' | 'ui' | 'security';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: unknown;
}

const STORAGE_KEY = 'budget:debug';
const MAX_LOG_ENTRIES = 100;

// In-memory log buffer for debugging
const logBuffer: LogEntry[] = [];

/**
 * Check if debug logging is enabled for a category.
 */
function isEnabled(category: LogCategory): boolean {
  if (import.meta.env.DEV) {
    return true; // Always enabled in development
  }

  try {
    const setting = localStorage.getItem(STORAGE_KEY);
    if (!setting) return false;
    if (setting === 'true' || setting === '*') return true;
    return setting.split(',').includes(category);
  } catch {
    return false;
  }
}

/**
 * Add entry to log buffer (circular buffer).
 */
function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
}

/**
 * Format timestamp for logging.
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a log entry and optionally output to console.
 */
function log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data,
  };

  // Always add to buffer for later retrieval
  addToBuffer(entry);

  // Only output to console if enabled
  if (!isEnabled(category)) return;

  const prefix = `[${category.toUpperCase()}]`;
  const consoleFn = console[level] || console.log;

  if (data !== undefined) {
    consoleFn(prefix, message, data);
  } else {
    consoleFn(prefix, message);
  }
}

/**
 * Debug logger with category-specific methods.
 */
export const debug = {
  /**
   * Log a debug message (lowest priority, verbose).
   */
  debug: (category: LogCategory, message: string, data?: unknown) =>
    log('debug', category, message, data),

  /**
   * Log an info message (general information).
   */
  info: (category: LogCategory, message: string, data?: unknown) =>
    log('info', category, message, data),

  /**
   * Log a warning message (potential issues).
   */
  warn: (category: LogCategory, message: string, data?: unknown) =>
    log('warn', category, message, data),

  /**
   * Log an error message (errors and exceptions).
   */
  error: (category: LogCategory, message: string, data?: unknown) =>
    log('error', category, message, data),

  /**
   * Get recent log entries from the buffer.
   */
  getLogs: (): readonly LogEntry[] => [...logBuffer],

  /**
   * Clear the log buffer.
   */
  clearLogs: (): void => {
    logBuffer.length = 0;
  },

  /**
   * Export logs as JSON string for debugging.
   */
  exportLogs: (): string => {
    return JSON.stringify(logBuffer, null, 2);
  },

  /**
   * Check if debug mode is enabled for a category.
   */
  isEnabled,
};

// Expose debug helper on window for console access in production
if (typeof window !== 'undefined') {
  (window as unknown as { __budgetDebug: typeof debug }).__budgetDebug = debug;
}
