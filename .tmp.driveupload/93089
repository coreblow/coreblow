/**
 * Logging Tests — Phase B: Business Logic
 * Tests: LOG_LEVELS, shouldLog, formatLog
 */
import { describe, it, expect } from 'vitest';
import { LOG_LEVELS, shouldLog } from './log-levels.js';
import { formatLog } from './log-formatter.js';

describe('LOG_LEVELS', () => {
    it('has correct level hierarchy', () => {
        expect(LOG_LEVELS.trace).toBeLessThan(LOG_LEVELS.debug);
        expect(LOG_LEVELS.debug).toBeLessThan(LOG_LEVELS.info);
        expect(LOG_LEVELS.info).toBeLessThan(LOG_LEVELS.warn);
        expect(LOG_LEVELS.warn).toBeLessThan(LOG_LEVELS.error);
        expect(LOG_LEVELS.error).toBeLessThan(LOG_LEVELS.fatal);
    });
});

describe('shouldLog', () => {
    it('allows same level', () => { expect(shouldLog('info', 'info')).toBe(true); });
    it('allows higher level', () => { expect(shouldLog('error', 'info')).toBe(true); });
    it('blocks lower level', () => { expect(shouldLog('debug', 'info')).toBe(false); });
    it('trace passes when config is trace', () => { expect(shouldLog('trace', 'trace')).toBe(true); });
    it('fatal always passes', () => { expect(shouldLog('fatal', 'fatal')).toBe(true); });
    it('trace blocked by warn', () => { expect(shouldLog('trace', 'warn')).toBe(false); });
    it('debug blocked by error', () => { expect(shouldLog('debug', 'error')).toBe(false); });
    it('warn passes at info level', () => { expect(shouldLog('warn', 'info')).toBe(true); });
});

describe('formatLog', () => {
    it('formats with timestamp', () => {
        const formatted = formatLog('info', 'test', 'hello');
        expect(formatted).toMatch(/^\[.*T.*\] \[info\] \[test\] hello$/);
    });

    it('includes level', () => {
        expect(formatLog('error', 'mod', 'msg')).toContain('[error]');
    });

    it('includes module', () => {
        expect(formatLog('info', 'gateway', 'msg')).toContain('[gateway]');
    });

    it('includes message', () => {
        expect(formatLog('debug', 'm', 'my message')).toContain('my message');
    });
});
