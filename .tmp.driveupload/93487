/**
 * Wave 5 — Sandbox Hardening Tests
 *
 * Tests for: resource-limiter.ts, path-jail.ts, audit-log.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResourceLimiter, getLimitProfile } from '../../src/plugins/resource-limiter.js';
import { PathJail } from '../../src/plugins/path-jail.js';
import { AuditLog } from '../../src/plugins/audit-log.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// ResourceLimiter
// ═══════════════════════════════════════════════════════════════════

describe('ResourceLimiter', () => {
    let limiter: ResourceLimiter;

    beforeEach(() => {
        limiter = new ResourceLimiter('test-plugin', { maxConcurrentOps: 3, maxOpsPerMinute: 10 });
    });

    afterEach(() => {
        limiter.dispose();
    });

    describe('getLimitProfile', () => {
        it('should return strict limits', () => {
            const limits = getLimitProfile('strict');
            expect(limits.maxMemoryMB).toBe(64);
            expect(limits.maxConcurrentOps).toBe(3);
        });

        it('should return unlimited limits', () => {
            const limits = getLimitProfile('unlimited');
            expect(limits.maxMemoryMB).toBe(0);
            expect(limits.maxConcurrentOps).toBe(0);
        });
    });

    describe('acquireOp / releaseOp', () => {
        it('should allow ops within limit', () => {
            expect(limiter.acquireOp('op1')).toBe(true);
            expect(limiter.acquireOp('op2')).toBe(true);
            expect(limiter.acquireOp('op3')).toBe(true);
        });

        it('should deny ops exceeding concurrent limit', () => {
            limiter.acquireOp('op1');
            limiter.acquireOp('op2');
            limiter.acquireOp('op3');
            expect(limiter.acquireOp('op4')).toBe(false);
            expect(limiter.hasViolations()).toBe(true);
        });

        it('should allow more ops after release', () => {
            limiter.acquireOp('op1');
            limiter.acquireOp('op2');
            limiter.acquireOp('op3');
            limiter.releaseOp();
            expect(limiter.acquireOp('op4')).toBe(true);
        });
    });

    describe('rate limiting', () => {
        it('should deny when ops per minute exceeded', () => {
            const limiter2 = new ResourceLimiter('test', { maxConcurrentOps: 100, maxOpsPerMinute: 5 });
            for (let i = 0; i < 5; i++) {
                expect(limiter2.acquireOp(`op${i}`)).toBe(true);
                limiter2.releaseOp();
            }
            expect(limiter2.acquireOp('op-over')).toBe(false);
            limiter2.dispose();
        });
    });

    describe('checkNetwork', () => {
        it('should allow requests within limit', () => {
            const limiter2 = new ResourceLimiter('test', { maxNetworkReqPerMinute: 5 });
            expect(limiter2.checkNetwork('GET /api')).toBe(true);
            limiter2.dispose();
        });

        it('should deny when network rate exceeded', () => {
            const limiter2 = new ResourceLimiter('test', { maxNetworkReqPerMinute: 2 });
            limiter2.checkNetwork('req1');
            limiter2.checkNetwork('req2');
            expect(limiter2.checkNetwork('req3')).toBe(false);
            limiter2.dispose();
        });
    });

    describe('checkFileSize', () => {
        it('should allow files within limit', () => {
            const limiter2 = new ResourceLimiter('test', { maxFileSizeBytes: 1024 });
            expect(limiter2.checkFileSize(512, 'write')).toBe(true);
            limiter2.dispose();
        });

        it('should deny oversized files', () => {
            const limiter2 = new ResourceLimiter('test', { maxFileSizeBytes: 1024 });
            expect(limiter2.checkFileSize(2048, 'write')).toBe(false);
            limiter2.dispose();
        });
    });

    describe('withTimeout', () => {
        it('should resolve fast operations', async () => {
            const limiter2 = new ResourceLimiter('test', { maxCpuTimeMs: 5000 });
            const result = await limiter2.withTimeout(async () => 42, 'compute');
            expect(result).toBe(42);
            limiter2.dispose();
        });

        it('should reject timed-out operations', async () => {
            const limiter2 = new ResourceLimiter('test', { maxCpuTimeMs: 50 });
            await expect(
                limiter2.withTimeout(
                    () => new Promise((resolve) => setTimeout(resolve, 200)),
                    'slow',
                ),
            ).rejects.toThrow('timed out');
            limiter2.dispose();
        });
    });

    describe('getUsage', () => {
        it('should track usage stats', () => {
            limiter.acquireOp('op1');
            const usage = limiter.getUsage();
            expect(usage.pluginId).toBe('test-plugin');
            expect(usage.currentOps).toBe(1);
            expect(usage.opsThisMinute).toBe(1);
        });
    });

    describe('reset', () => {
        it('should clear all counters', () => {
            limiter.acquireOp('op1');
            limiter.reset();
            expect(limiter.getUsage().currentOps).toBe(0);
            expect(limiter.hasViolations()).toBe(false);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PathJail
// ═══════════════════════════════════════════════════════════════════

describe('PathJail', () => {
    let tmpDir: string;
    let jail: PathJail;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-jail-'));
        jail = new PathJail({
            pluginId: 'test-plugin',
            allowedRoots: [tmpDir],
            maxPathDepth: 20,
        });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('basic path checking', () => {
        it('should allow paths within root', () => {
            const result = jail.check(path.join(tmpDir, 'file.txt'), 'read');
            expect(result.allowed).toBe(true);
        });

        it('should deny paths outside root', () => {
            const result = jail.check('/etc/passwd', 'read');
            expect(result.allowed).toBe(false);
        });

        it('should deny path traversal', () => {
            const result = jail.check(path.join(tmpDir, '..', '..', 'etc', 'passwd'), 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('blocked patterns', () => {
        it('should block .env files', () => {
            const result = jail.check(path.join(tmpDir, '.env'), 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block .env.* files', () => {
            const result = jail.check(path.join(tmpDir, '.env.production'), 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block .pem files', () => {
            const result = jail.check(path.join(tmpDir, 'cert.pem'), 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('read-only roots', () => {
        it('should allow read but deny write in read-only roots', () => {
            const readOnlyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readonly-'));
            const roJail = new PathJail({
                pluginId: 'test',
                allowedRoots: [tmpDir],
                readOnlyRoots: [readOnlyDir],
            });

            const readResult = roJail.check(path.join(readOnlyDir, 'file.txt'), 'read');
            expect(readResult.allowed).toBe(true);

            const writeResult = roJail.check(path.join(readOnlyDir, 'file.txt'), 'write');
            expect(writeResult.allowed).toBe(false);

            fs.rmSync(readOnlyDir, { recursive: true, force: true });
        });
    });

    describe('guard', () => {
        it('should return resolved path on success', () => {
            const result = jail.guard(path.join(tmpDir, 'ok.txt'), 'read');
            expect(result).toContain(tmpDir);
        });

        it('should throw on violation', () => {
            expect(() => jail.guard('/etc/shadow', 'read')).toThrow('path access denied');
        });
    });

    describe('forPlugin', () => {
        it('should create a jail for plugin data directory', () => {
            const pluginJail = PathJail.forPlugin('my-plugin', tmpDir);
            expect(pluginJail.getAllowedRoots()).toContain(path.resolve(tmpDir));
        });
    });

    describe('violations', () => {
        it('should record violations', () => {
            jail.check('/etc/passwd', 'read');
            jail.check('/root/.ssh/id_rsa', 'read');
            expect(jail.getViolationCount()).toBe(2);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// AuditLog
// ═══════════════════════════════════════════════════════════════════

describe('AuditLog', () => {
    let audit: AuditLog;

    beforeEach(() => {
        audit = new AuditLog();
    });

    describe('recording', () => {
        it('should record events', () => {
            const event = audit.record({
                pluginId: 'p1',
                category: 'lifecycle',
                severity: 'info',
                action: 'loaded',
            });
            expect(event.id).toBeDefined();
            expect(event.pluginId).toBe('p1');
            expect(audit.count()).toBe(1);
        });

        it('should enforce max events', () => {
            const small = new AuditLog({ maxEvents: 5 });
            for (let i = 0; i < 10; i++) {
                small.record({ pluginId: 'p', category: 'lifecycle', severity: 'info', action: `op${i}` });
            }
            expect(small.count()).toBe(5);
        });
    });

    describe('convenience recorders', () => {
        it('should record permission checks', () => {
            audit.recordPermissionCheck('p1', 'network', true, 'fetch');
            audit.recordPermissionCheck('p1', 'exec', false, 'shell');
            expect(audit.count()).toBe(2);
            expect(audit.getWarnings()).toHaveLength(1);
        });

        it('should record lifecycle events', () => {
            audit.recordLifecycle('p1', 'loaded', 'v1.0.0');
            expect(audit.count()).toBe(1);
        });

        it('should record resource violations', () => {
            audit.recordResourceViolation('p1', 'maxConcurrentOps', 3, 4, 'fetch');
            expect(audit.getWarnings()).toHaveLength(1);
        });

        it('should record filesystem operations', () => {
            audit.recordFilesystem('p1', 'read', '/tmp/file.txt', true);
            audit.recordFilesystem('p1', 'write', '/etc/passwd', false);
            expect(audit.count()).toBe(2);
        });

        it('should record network requests', () => {
            audit.recordNetwork('p1', 'GET', 'https://api.example.com/data', true);
            expect(audit.count()).toBe(1);
        });

        it('should sanitize URLs with tokens', () => {
            audit.recordNetwork('p1', 'GET', 'https://api.com?token=secret123&name=ok', true);
            const event = audit.recent(1)[0]!;
            expect(event.detail).not.toContain('secret123');
            expect(event.detail).toContain('***');
        });

        it('should record exec events', () => {
            audit.recordExec('p1', 'rm -rf /important', false);
            const critical = audit.getCritical();
            expect(critical).toHaveLength(1);
        });
    });

    describe('querying', () => {
        beforeEach(() => {
            audit.recordLifecycle('p1', 'loaded');
            audit.recordPermissionCheck('p1', 'network', true, 'fetch');
            audit.recordPermissionCheck('p2', 'exec', false, 'shell');
            audit.recordFilesystem('p1', 'read', '/tmp/a', true);
        });

        it('should filter by plugin', () => {
            const results = audit.query({ pluginId: 'p1' });
            expect(results).toHaveLength(3);
        });

        it('should filter by category', () => {
            const results = audit.query({ category: 'permission' });
            expect(results).toHaveLength(2);
        });

        it('should filter by severity', () => {
            const results = audit.query({ severity: 'warn' });
            expect(results).toHaveLength(1);
        });

        it('should paginate results', () => {
            const results = audit.query({ limit: 2, offset: 0 });
            expect(results).toHaveLength(2);
        });
    });

    describe('statistics', () => {
        it('should aggregate stats', () => {
            audit.recordLifecycle('p1', 'loaded');
            audit.recordPermissionCheck('p1', 'network', false, 'fetch');
            const stats = audit.getStats();
            expect(stats.totalEvents).toBe(2);
            expect(stats.byPlugin['p1']).toBe(2);
        });
    });

    describe('listeners', () => {
        it('should notify listeners on new events', () => {
            let received: unknown;
            const unsub = audit.onEvent((event) => { received = event; });
            audit.recordLifecycle('p1', 'loaded');
            expect(received).toBeDefined();
            unsub();
        });

        it('should unsubscribe', () => {
            let count = 0;
            const unsub = audit.onEvent(() => { count++; });
            audit.recordLifecycle('p1', 'loaded');
            unsub();
            audit.recordLifecycle('p2', 'loaded');
            expect(count).toBe(1);
        });
    });

    describe('export', () => {
        it('should export JSON lines', () => {
            audit.recordLifecycle('p1', 'loaded');
            audit.recordLifecycle('p2', 'loaded');
            const lines = audit.exportJsonLines().split('\n');
            expect(lines).toHaveLength(2);
            expect(JSON.parse(lines[0]!).pluginId).toBe('p1');
        });

        it('should export formatted text', () => {
            audit.recordLifecycle('p1', 'loaded');
            const text = audit.exportText();
            expect(text).toContain('p1');
            expect(text).toContain('🟢');
        });
    });

    describe('clear', () => {
        it('should clear all events', () => {
            audit.recordLifecycle('p1', 'loaded');
            audit.clear();
            expect(audit.count()).toBe(0);
        });
    });
});
