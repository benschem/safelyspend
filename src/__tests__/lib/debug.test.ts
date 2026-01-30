import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { debug, type LogEntry, type LogCategory, type LogLevel } from '@/lib/debug';

describe('debug logger', () => {
  beforeEach(() => {
    debug.clearLogs();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log buffer', () => {
    it('stores log entries in buffer', () => {
      debug.info('db', 'test message');
      const logs = debug.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('test message');
      expect(logs[0]!.category).toBe('db');
      expect(logs[0]!.level).toBe('info');
    });

    it('stores entries with data', () => {
      const testData = { foo: 'bar', count: 42 };
      debug.info('db', 'test with data', testData);
      const logs = debug.getLogs();
      expect(logs[0]!.data).toEqual(testData);
    });

    it('includes ISO timestamp', () => {
      debug.info('db', 'test');
      const logs = debug.getLogs();
      expect(logs[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('maintains circular buffer (max 100 entries)', () => {
      for (let i = 0; i < 150; i++) {
        debug.info('db', `message ${i}`);
      }
      const logs = debug.getLogs();
      expect(logs).toHaveLength(100);
      expect(logs[0]!.message).toBe('message 50'); // First 50 were removed
      expect(logs[99]!.message).toBe('message 149');
    });

    it('clearLogs empties the buffer', () => {
      debug.info('db', 'test');
      expect(debug.getLogs()).toHaveLength(1);
      debug.clearLogs();
      expect(debug.getLogs()).toHaveLength(0);
    });

    it('getLogs returns a copy (not mutable reference)', () => {
      debug.info('db', 'test');
      const logs = debug.getLogs();
      expect(logs).toHaveLength(1);

      // Modifying returned array shouldn't affect internal buffer
      (logs as LogEntry[]).push({
        timestamp: '',
        level: 'info',
        category: 'db',
        message: 'injected',
      });

      expect(debug.getLogs()).toHaveLength(1);
    });
  });

  describe('log levels', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

    levels.forEach((level) => {
      it(`logs ${level} level correctly`, () => {
        debug[level]('db', `${level} message`);
        const logs = debug.getLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0]!.level).toBe(level);
      });
    });
  });

  describe('log categories', () => {
    const categories: LogCategory[] = ['db', 'import', 'storage', 'ui', 'security'];

    categories.forEach((category) => {
      it(`logs ${category} category correctly`, () => {
        debug.info(category, 'test message');
        const logs = debug.getLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0]!.category).toBe(category);
      });
    });
  });

  describe('exportLogs', () => {
    it('exports logs as JSON string', () => {
      debug.info('db', 'test message', { key: 'value' });
      const exported = debug.exportLogs();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('test message');
      expect(parsed[0].data).toEqual({ key: 'value' });
    });

    it('exports empty array when no logs', () => {
      const exported = debug.exportLogs();
      expect(exported).toBe('[]');
    });

    it('exports formatted JSON (pretty printed)', () => {
      debug.info('db', 'test');
      const exported = debug.exportLogs();
      expect(exported).toContain('\n'); // Has newlines for readability
    });
  });

  describe('isEnabled', () => {
    it('isEnabled function exists', () => {
      expect(typeof debug.isEnabled).toBe('function');
    });

    // In dev mode (vitest), isEnabled returns true for all categories
    it('returns true in development mode', () => {
      expect(debug.isEnabled('db')).toBe(true);
      expect(debug.isEnabled('import')).toBe(true);
      expect(debug.isEnabled('security')).toBe(true);
    });

    it('returns true when called without category in dev mode', () => {
      expect(debug.isEnabled()).toBe(true);
    });
  });

  describe('setEnabled', () => {
    it('setEnabled function exists', () => {
      expect(typeof debug.setEnabled).toBe('function');
    });

    it('can be called without error', () => {
      expect(() => debug.setEnabled(true)).not.toThrow();
      expect(() => debug.setEnabled(false)).not.toThrow();
    });
  });

  describe('console output in dev mode', () => {
    it('outputs to console.info for info level', () => {
      debug.info('db', 'info message');
      // eslint-disable-next-line no-console -- Testing console output
      expect(console.info).toHaveBeenCalledWith('[DB]', 'info message');
    });

    it('outputs to console.warn for warn level', () => {
      debug.warn('security', 'warning message');
      expect(console.warn).toHaveBeenCalledWith('[SECURITY]', 'warning message');
    });

    it('outputs to console.error for error level', () => {
      debug.error('import', 'error message');
      expect(console.error).toHaveBeenCalledWith('[IMPORT]', 'error message');
    });

    it('includes data in console output when provided', () => {
      const testData = { foo: 'bar' };
      debug.info('db', 'with data', testData);
      // eslint-disable-next-line no-console -- Testing console output
      expect(console.info).toHaveBeenCalledWith('[DB]', 'with data', testData);
    });
  });
});
