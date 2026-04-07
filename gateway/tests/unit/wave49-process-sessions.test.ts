import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GracefulShutdown } from '../../src/process/graceful-shutdown.js';
import { checkSendPolicy, recordSend, getDefaultPolicy } from '../../src/sessions/send-policy.js';
import type { SendPolicy } from '../../src/sessions/send-policy.js';

describe('Wave 49: Process & Sessions Engine', () => {

    describe('GracefulShutdown (graceful-shutdown.ts)', () => {
        let originalProcessExit: any;
        
        beforeEach(() => {
            vi.useFakeTimers();
            originalProcessExit = process.exit;
            process.exit = vi.fn() as any;
        });

        afterEach(() => {
            vi.useRealTimers();
            process.exit = originalProcessExit;
        });

        it('registers handlers and executes them on shutdown', async () => {
            const shutdown = new GracefulShutdown();
            const h1 = vi.fn().mockResolvedValue(undefined);
            const h2 = vi.fn().mockResolvedValue(undefined);
            
            shutdown.register('db', h1);
            shutdown.register('cache', h2);
            
            await shutdown.shutdown(1000);
            
            expect(h1).toHaveBeenCalledTimes(1);
            expect(h2).toHaveBeenCalledTimes(1);
        });

        it('continues shutdown even if a handler fails', async () => {
            const shutdown = new GracefulShutdown();
            const h1 = vi.fn().mockRejectedValue(new Error('Crash'));
            const h2 = vi.fn().mockResolvedValue(undefined);
            
            shutdown.register('db', h1);
            shutdown.register('cache', h2);
            
            await shutdown.shutdown(1000);
            
            expect(h1).toHaveBeenCalledTimes(1);
            expect(h2).toHaveBeenCalledTimes(1); // Still executed
        });

        it('timeout triggers forced exit', async () => {
            const shutdown = new GracefulShutdown();
            let neverResolveVal!: any;
            
            // A handler that hangs forever
            const hang = vi.fn().mockImplementation(() => new Promise((resolve) => {
                neverResolveVal = resolve; 
            }));
            shutdown.register('hang', hang);
            
            // Don't await shutdown directly, it's blocked by the handler!
            // Wait, shutdown() internally awaits h.fn().
            // So if h.fn() hangs, shutdown() hangs.
            // But shutdown() sets a timer first to do process.exit(1).
            const p = shutdown.shutdown(3000);
            
            await vi.advanceTimersByTimeAsync(3000);
            
            expect(process.exit).toHaveBeenCalledWith(1);
            
            // Cleanup to avoid hanging test
            neverResolveVal();
            await p;
        });
    });

    describe('Send Policy (send-policy.ts)', () => {
        let policy: SendPolicy;

        beforeEach(() => {
            policy = getDefaultPolicy();
            vi.useFakeTimers();
            vi.setSystemTime(Date.now());
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('blocks users in the blocklist', () => {
            policy.blocklist = ['bad-user'];
            const res = checkSendPolicy('sess1', 'bad-user', policy);
            expect(res.allowed).toBe(false);
            expect(res.reason).toContain('blocked');
        });

        it('allows normal sending', () => {
            const res = checkSendPolicy('sess2', 'user', policy);
            expect(res.allowed).toBe(true);
        });

        it('enforces cooldown between messages', async () => {
            const sid = 'sess3';
            checkSendPolicy(sid, 'user', policy);
            recordSend(sid);
            
            // immediately send again
            const res = checkSendPolicy(sid, 'user', policy);
            expect(res.allowed).toBe(false);
            expect(res.reason).toContain('Cooldown');

            // advance time past cooldown
            await vi.advanceTimersByTimeAsync(600);
            const res2 = checkSendPolicy(sid, 'user', policy);
            expect(res2.allowed).toBe(true);
        });

        it('enforces max messages per minute', async () => {
            const sid = 'sess4';
            policy.maxMessagesPerMinute = 3;
            policy.cooldownMs = 0; // disable cooldown for test

            checkSendPolicy(sid, 'user', policy); recordSend(sid);
            checkSendPolicy(sid, 'user', policy); recordSend(sid);
            checkSendPolicy(sid, 'user', policy); recordSend(sid);

            const res = checkSendPolicy(sid, 'user', policy);
            expect(res.allowed).toBe(false);
            expect(res.reason).toContain('Rate limit');

            // advance past 1 minute
            await vi.advanceTimersByTimeAsync(61_000);
            
            const res2 = checkSendPolicy(sid, 'user', policy);
            expect(res2.allowed).toBe(true);
        });
    });

});
