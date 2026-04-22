import { describe, it, expect } from 'vitest';
import { SandboxSecurityPolicy } from './sandbox-security.js';

describe('SandboxSecurityPolicy', () => {
    const policy = new SandboxSecurityPolicy();

    describe('checkCode', () => {
        it('allows safe code', () => {
            expect(policy.checkCode('console.log("hello")')).toEqual({ allowed: true });
            expect(policy.checkCode('const x = 1 + 2;')).toEqual({ allowed: true });
        });

        it('blocks process.exit', () => {
            const result = policy.checkCode('process.exit(1)');
            expect(result.allowed).toBe(false);
            expect(result.blockedPattern).toBeTruthy();
        });

        it('blocks require child_process', () => {
            const result = policy.checkCode('require("child_process")');
            expect(result.allowed).toBe(false);
        });

        it('blocks require fs', () => {
            const result = policy.checkCode("require('fs')");
            expect(result.allowed).toBe(false);
        });

        it('blocks __proto__', () => {
            const result = policy.checkCode('obj.__proto__.polluted = true');
            expect(result.allowed).toBe(false);
        });

        it('blocks import()', () => {
            const result = policy.checkCode('import("os")');
            expect(result.allowed).toBe(false);
        });

        it('rejects oversized code', () => {
            const big = 'x'.repeat(200_000);
            expect(policy.checkCode(big).allowed).toBe(false);
        });
    });

    describe('validateLimits', () => {
        it('allows valid limits', () => {
            expect(policy.validateLimits(5000, 256)).toEqual({ allowed: true });
        });

        it('rejects excessive timeout', () => {
            const result = policy.validateLimits(999_999);
            expect(result.allowed).toBe(false);
        });

        it('rejects excessive memory', () => {
            const result = policy.validateLimits(undefined, 99_999);
            expect(result.allowed).toBe(false);
        });

        it('rejects too-low timeout', () => {
            const result = policy.validateLimits(10);
            expect(result.allowed).toBe(false);
        });
    });

    describe('checkCommand', () => {
        it('allows safe commands', () => {
            expect(policy.checkCommand('ls -la')).toEqual({ allowed: true });
            expect(policy.checkCommand('echo hello')).toEqual({ allowed: true });
        });

        it('blocks empty commands', () => {
            expect(policy.checkCommand('').allowed).toBe(false);
            expect(policy.checkCommand('   ').allowed).toBe(false);
        });

        it('blocks dangerous patterns with rm', () => {
            const result = policy.checkCommand('$(rm -rf /)');
            expect(result.allowed).toBe(false);
        });
    });

    describe('custom config', () => {
        it('supports custom blocked patterns', () => {
            const custom = new SandboxSecurityPolicy({
                blockedPatterns: ['custom_danger'],
            });
            expect(custom.checkCode('custom_danger()').allowed).toBe(false);
            expect(custom.checkCode('safe_code()').allowed).toBe(true);
        });
    });
});
