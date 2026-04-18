/**
 * plugins/sandbox.test.ts
 *
 * Comprehensive tests for PluginSandbox, PathJail, and ResourceLimiter.
 * Covers permission enforcement, path traversal prevention, resource
 * budgets, violation tracking, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginSandbox, type Permission } from './sandbox.js';
import { PathJail, type PathCheckResult } from './path-jail.js';
import { ResourceLimiter, getLimitProfile } from './resource-limiter.js';
import * as path from 'node:path';

// ─── PluginSandbox Tests ─────────────────────────────────────────

describe('PluginSandbox', () => {
    describe('permission checking', () => {
        it('should grant declared permissions', () => {
            const sandbox = new PluginSandbox({
                pluginName: 'test',
                permissions: ['network', 'env'],
            });
            expect(sandbox.hasPermission('network')).toBe(true);
            expect(sandbox.hasPermission('env')).toBe(true);
        });

        it('should deny undeclared permissions', () => {
            const sandbox = new PluginSandbox({
                pluginName: 'test',
                permissions: [],
            });
            expect(sandbox.hasPermission('network')).toBe(false);
            expect(sandbox.hasPermission('filesystem')).toBe(false);
            expect(sandbox.hasPermission('exec')).toBe(false);
        });

        it('should handle all permission types', () => {
            const allPerms: Permission[] = ['network', 'filesystem', 'exec', 'env', 'secrets'];
            const sandbox = new PluginSandbox({ pluginName: 'full', permissions: allPerms });
            for (const perm of allPerms) {
                expect(sandbox.hasPermission(perm)).toBe(true);
            }
        });
    });

    describe('sandboxed API', () => {
        it('should create API object', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: ['network'] });
            const api = sandbox.createAPI();
            expect(api).toBeDefined();
            expect(api.log).toBeDefined();
            expect(api.store).toBeDefined();
        });

        it('should allow log without permissions', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(api.log.info).toBeDefined();
            expect(api.log.warn).toBeDefined();
            expect(api.log.error).toBeDefined();
        });

        it('should provide scoped KV store', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            api.store.set('key', 'value');
            expect(api.store.get('key')).toBe('value');
            api.store.delete('key');
            expect(api.store.get('key')).toBeUndefined();
        });

        it('should deny network without permission', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(() => api.fetch('http://example.com' as any)).toThrow('denied');
        });

        it('should deny filesystem without permission', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(() => api.readFile('/etc/passwd')).toThrow('denied');
            expect(() => api.writeFile('/tmp/x', 'data')).toThrow('denied');
        });

        it('should deny exec without permission', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(() => api.exec('ls')).toThrow('denied');
        });

        it('should deny env without permission', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(() => api.getEnv('HOME')).toThrow('denied');
        });

        it('should deny secrets without permission', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            expect(() => api.getSecret('api_key')).toThrow('denied');
        });

        it('should use secrets provider when permitted', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: ['secrets'] });
            const api = sandbox.createAPI((key) => key === 'token' ? 'secret123' : undefined);
            expect(api.getSecret('token')).toBe('secret123');
            expect(api.getSecret('other')).toBeUndefined();
        });
    });

    describe('violations', () => {
        it('should record violations', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            try { api.getEnv('X'); } catch {}
            try { api.getEnv('Y'); } catch {}
            expect(sandbox.getViolations()).toHaveLength(2);
        });

        it('should include violation details', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: [] });
            const api = sandbox.createAPI();
            try { api.getEnv('X'); } catch {}
            const v = sandbox.getViolations()[0];
            expect(v.permission).toBe('env');
            expect(v.action).toBe('getEnv');
        });
    });

    describe('info', () => {
        it('should return sandbox info', () => {
            const sandbox = new PluginSandbox({ pluginName: 'test', permissions: ['network'] });
            const api = sandbox.createAPI();
            api.store.set('key', 'val');
            const info = sandbox.getInfo();
            expect(info.pluginName).toBe('test');
            expect(info.permissions).toContain('network');
            expect(info.storeSize).toBe(1);
        });
    });

    describe('factory', () => {
        it('should create from manifest', () => {
            const sandbox = PluginSandbox.fromManifest({
                name: 'test-plugin',
                version: '1.0.0',
                permissions: ['network', 'env'],
            } as any);
            expect(sandbox.hasPermission('network')).toBe(true);
            expect(sandbox.hasPermission('env')).toBe(true);
        });
    });
});

// ─── PathJail Tests ──────────────────────────────────────────────

describe('PathJail', () => {
    const ROOT = '/tmp/plugin-data';
    let jail: PathJail;

    beforeEach(() => {
        jail = new PathJail({
            pluginId: 'test-plugin',
            allowedRoots: [ROOT],
            readOnlyRoots: ['/tmp/workspace'],
            maxPathDepth: 20,
        });
    });

    describe('access control', () => {
        it('should allow read in allowed root', () => {
            const result = jail.checkRead(`${ROOT}/config.json`);
            expect(result.allowed).toBe(true);
        });

        it('should allow write in allowed root', () => {
            const result = jail.checkWrite(`${ROOT}/output.txt`);
            expect(result.allowed).toBe(true);
        });

        it('should allow read in read-only root', () => {
            const result = jail.checkRead('/tmp/workspace/file.txt');
            expect(result.allowed).toBe(true);
        });

        it('should deny write in read-only root', () => {
            const result = jail.checkWrite('/tmp/workspace/file.txt');
            expect(result.allowed).toBe(false);
        });

        it('should deny delete in read-only root', () => {
            const result = jail.checkDelete('/tmp/workspace/file.txt');
            expect(result.allowed).toBe(false);
        });

        it('should deny access outside roots', () => {
            const result = jail.check('/home/user/secrets', 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('path traversal', () => {
        it('should block .. traversal', () => {
            const result = jail.check(`${ROOT}/../../../etc/passwd`, 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block double-dot sequences', () => {
            const result = jail.check(`${ROOT}/../../secret`, 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('blocked paths', () => {
        it('should block /etc/passwd', () => {
            const result = jail.check('/etc/passwd', 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block /etc/shadow', () => {
            const result = jail.check('/etc/shadow', 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block /proc', () => {
            const result = jail.check('/proc', 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('blocked patterns', () => {
        it('should block .env files', () => {
            const result = jail.check(`${ROOT}/.env`, 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block .env.* files', () => {
            const result = jail.check(`${ROOT}/.env.production`, 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block .pem files', () => {
            const result = jail.check(`${ROOT}/cert.pem`, 'read');
            expect(result.allowed).toBe(false);
        });

        it('should block .key files', () => {
            const result = jail.check(`${ROOT}/private.key`, 'read');
            expect(result.allowed).toBe(false);
        });
    });

    describe('guard', () => {
        it('should return resolved path on success', () => {
            const resolved = jail.guard(`${ROOT}/file.txt`, 'read');
            expect(resolved).toBe(path.resolve(`${ROOT}/file.txt`));
        });

        it('should throw on violation', () => {
            expect(() => jail.guard('/etc/passwd', 'read')).toThrow('denied');
        });
    });

    describe('violations', () => {
        it('should track violations', () => {
            jail.check('/etc/passwd', 'read');
            jail.check('/etc/shadow', 'read');
            expect(jail.getViolationCount()).toBe(2);
        });

        it('should return violation details', () => {
            jail.check('/etc/passwd', 'read');
            const violations = jail.getViolations();
            expect(violations[0].mode).toBe('read');
        });
    });

    describe('info', () => {
        it('should return jail info', () => {
            const info = jail.getInfo();
            expect(info.pluginId).toBe('test-plugin');
            expect(info.allowedRoots.length).toBeGreaterThan(0);
        });

        it('should list allowed roots', () => {
            expect(jail.getAllowedRoots()).toHaveLength(1);
        });

        it('should list read-only roots', () => {
            expect(jail.getReadOnlyRoots()).toHaveLength(1);
        });
    });

    describe('factory', () => {
        it('should create jail for plugin', () => {
            const j = PathJail.forPlugin('my-plugin', '/tmp/my-plugin-data');
            const result = j.checkWrite('/tmp/my-plugin-data/output.json');
            expect(result.allowed).toBe(true);
        });

        it('should support workspace directory', () => {
            const j = PathJail.forPlugin('my-plugin', '/tmp/data', '/tmp/workspace');
            expect(j.checkRead('/tmp/workspace/file.txt').allowed).toBe(true);
        });
    });
});

// ─── ResourceLimiter Tests ───────────────────────────────────────

describe('ResourceLimiter', () => {
    let limiter: ResourceLimiter;

    beforeEach(() => {
        limiter = new ResourceLimiter('test-plugin', {
            maxConcurrentOps: 3,
            maxOpsPerMinute: 10,
            maxNetworkReqPerMinute: 5,
            maxFileSizeBytes: 1024,
            maxStoreEntries: 50,
            maxCpuTimeMs: 1000,
        });
    });

    describe('profiles', () => {
        it('should load strict profile', () => {
            const limits = getLimitProfile('strict');
            expect(limits.maxMemoryMB).toBe(64);
            expect(limits.maxConcurrentOps).toBe(3);
        });

        it('should load standard profile', () => {
            const limits = getLimitProfile('standard');
            expect(limits.maxMemoryMB).toBe(256);
        });

        it('should load permissive profile', () => {
            const limits = getLimitProfile('permissive');
            expect(limits.maxMemoryMB).toBe(512);
        });

        it('should load unlimited profile', () => {
            const limits = getLimitProfile('unlimited');
            expect(limits.maxMemoryMB).toBe(0);
        });

        it('should create limiter from profile string', () => {
            const l = new ResourceLimiter('test', 'strict');
            expect(l.getLimits().maxMemoryMB).toBe(64);
        });
    });

    describe('concurrent ops', () => {
        it('should allow ops within limit', () => {
            expect(limiter.acquireOp('action1')).toBe(true);
            expect(limiter.acquireOp('action2')).toBe(true);
            expect(limiter.acquireOp('action3')).toBe(true);
        });

        it('should deny when concurrent limit exceeded', () => {
            limiter.acquireOp('a');
            limiter.acquireOp('b');
            limiter.acquireOp('c');
            expect(limiter.acquireOp('d')).toBe(false);
        });

        it('should allow ops after release', () => {
            limiter.acquireOp('a');
            limiter.acquireOp('b');
            limiter.acquireOp('c');
            limiter.releaseOp();
            expect(limiter.acquireOp('d')).toBe(true);
        });
    });

    describe('network limits', () => {
        it('should allow requests within limit', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.checkNetwork(`req${i}`)).toBe(true);
            }
        });

        it('should deny when network limit exceeded', () => {
            for (let i = 0; i < 5; i++) limiter.checkNetwork(`req${i}`);
            expect(limiter.checkNetwork('extra')).toBe(false);
        });
    });

    describe('file size limits', () => {
        it('should allow small files', () => {
            expect(limiter.checkFileSize(512, 'write')).toBe(true);
        });

        it('should deny files exceeding limit', () => {
            expect(limiter.checkFileSize(2048, 'write')).toBe(false);
        });
    });

    describe('store limits', () => {
        it('should allow entries within limit', () => {
            expect(limiter.checkStoreEntry(10, 'set')).toBe(true);
        });

        it('should deny when store limit reached', () => {
            expect(limiter.checkStoreEntry(50, 'set')).toBe(false);
        });
    });

    describe('timeout', () => {
        it('should execute fast operations', async () => {
            const result = await limiter.withTimeout(async () => 42, 'fast-op');
            expect(result).toBe(42);
        });

        it('should timeout slow operations', async () => {
            const slowLimiter = new ResourceLimiter('test', { maxCpuTimeMs: 50 });
            await expect(
                slowLimiter.withTimeout(
                    () => new Promise((resolve) => setTimeout(resolve, 200)),
                    'slow-op',
                ),
            ).rejects.toThrow('timed out');
        });
    });

    describe('violations', () => {
        it('should track violations', () => {
            for (let i = 0; i < 4; i++) limiter.acquireOp(`op${i}`);
            expect(limiter.hasViolations()).toBe(true);
            expect(limiter.getViolationCount()).toBe(1);
        });

        it('should include violation details', () => {
            for (let i = 0; i < 4; i++) limiter.acquireOp(`op${i}`);
            const v = limiter.getViolations()[0];
            expect(v.resource).toBe('maxConcurrentOps');
            expect(v.pluginId).toBe('test-plugin');
        });
    });

    describe('usage and reset', () => {
        it('should report usage', () => {
            limiter.acquireOp('test');
            const usage = limiter.getUsage();
            expect(usage.currentOps).toBe(1);
            expect(usage.opsThisMinute).toBe(1);
        });

        it('should reset all counters', () => {
            limiter.acquireOp('test');
            limiter.checkNetwork('req');
            limiter.reset();
            const usage = limiter.getUsage();
            expect(usage.currentOps).toBe(0);
            expect(usage.networkReqThisMinute).toBe(0);
            expect(usage.violations).toHaveLength(0);
        });

        it('should dispose cleanly', () => {
            expect(() => limiter.dispose()).not.toThrow();
        });
    });
});
