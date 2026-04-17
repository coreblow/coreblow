import { describe, it, expect, vi } from 'vitest';
import { fireAndForgetHook } from '../../src/hooks/fire-and-forget.js';

describe('hooks/fire-and-forget', () => {
    it('does not throw on resolved promise', () => {
        expect(() => {
            fireAndForgetHook(Promise.resolve(), 'test');
        }).not.toThrow();
    });

    it('logs error on rejected promise', async () => {
        const logger = vi.fn();
        fireAndForgetHook(Promise.reject(new Error('boom')), 'myLabel', logger);

        // Give the microtask queue time to flush
        await new Promise(r => setTimeout(r, 10));
        expect(logger).toHaveBeenCalledWith('myLabel: Error: boom');
    });

    it('logs string errors', async () => {
        const logger = vi.fn();
        fireAndForgetHook(Promise.reject('string-error'), 'label', logger);

        await new Promise(r => setTimeout(r, 10));
        expect(logger).toHaveBeenCalledWith('label: string-error');
    });

    it('uses default logger when none provided', () => {
        // Should not throw
        expect(() => {
            fireAndForgetHook(Promise.resolve(), 'default-logger-test');
        }).not.toThrow();
    });
});
