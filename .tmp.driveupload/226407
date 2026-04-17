/**
 * Tests: Logging — ContextLogger, log levels, formatter, rotation
 */
import { describe, it, expect, vi } from 'vitest';
import { ContextLogger } from '../../src/logging/context-logger.js';
import { formatLog } from '../../src/logging/log-formatter.js';
import { LOG_LEVELS, shouldLog } from '../../src/logging/log-levels.js';

describe('ContextLogger', () => {
    it('creates a logger', () => {
        const logger = new ContextLogger({ service: 'test' });
        expect(logger).toBeDefined();
    });

    it('creates child logger with extra context', () => {
        const parent = new ContextLogger({ service: 'test' });
        const child = parent.child({ requestId: 'abc' });
        expect(child).toBeDefined();
    });

    it('logs info without throwing', () => {
        const logger = new ContextLogger({ service: 'test' });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        logger.info('test message');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs error without throwing', () => {
        const logger = new ContextLogger({ service: 'test' });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logger.error('error message');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs warn without throwing', () => {
        const logger = new ContextLogger({ service: 'test' });
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        logger.warn('warn message');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('formatLog', () => {
    it('formats log string', () => {
        const result = formatLog('info', 'gateway', 'Server started');
        expect(result).toContain('info');
        expect(result).toContain('gateway');
        expect(result).toContain('Server started');
    });

    it('includes ISO timestamp', () => {
        const result = formatLog('error', 'test', 'msg');
        expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
});

describe('LOG_LEVELS', () => {
    it('has ordered levels', () => {
        expect(LOG_LEVELS.trace).toBeLessThan(LOG_LEVELS.debug);
        expect(LOG_LEVELS.debug).toBeLessThan(LOG_LEVELS.info);
        expect(LOG_LEVELS.info).toBeLessThan(LOG_LEVELS.warn);
        expect(LOG_LEVELS.warn).toBeLessThan(LOG_LEVELS.error);
        expect(LOG_LEVELS.error).toBeLessThan(LOG_LEVELS.fatal);
    });
});

describe('shouldLog', () => {
    it('allows error when config is info', () => {
        expect(shouldLog('error', 'info')).toBe(true);
    });

    it('blocks debug when config is info', () => {
        expect(shouldLog('debug', 'info')).toBe(false);
    });

    it('allows exact level match', () => {
        expect(shouldLog('warn', 'warn')).toBe(true);
    });
});
