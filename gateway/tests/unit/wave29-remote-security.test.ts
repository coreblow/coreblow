/**
 * Wave 29: Remote Plugins, Signatures & Migration
 *
 * Following OpenClaw's remote-loader.ts + signature-verify.ts + migration.ts
 * patterns, upgraded for CoreBlow OOP architecture.
 *
 * Tests PluginRemoteLoader, SignatureVerifier, and PluginMigrationEngine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRemoteLoader, type RemoteSource } from '../../src/plugins/remote-loader.js';
import { SignatureVerifier } from '../../src/plugins/signature-verify.js';
import { PluginMigrationEngine, type MigrationStep } from '../../src/plugins/migration.js';

// ═══════════════════════════════════════════════════════════════════
// PluginRemoteLoader
// ═══════════════════════════════════════════════════════════════════

describe('PluginRemoteLoader', () => {
    let loader: PluginRemoteLoader;

    beforeEach(() => { loader = new PluginRemoteLoader({ allowUnsigned: true }); });

    it('loads from URL source', async () => {
        const source: RemoteSource = { type: 'url', url: 'https://plugins.example.com/weather-v1.0.0.tar.gz' };
        const result = await loader.load(source);
        expect(result.success).toBe(true);
        expect(result.pluginId).toBe('weather-v1.0.0');
        expect(result.cached).toBe(false);
    });

    it('loads from NPM source', async () => {
        const source: RemoteSource = { type: 'npm', packageName: '@coreblow/plugin-weather', version: '1.0.0' };
        const result = await loader.load(source);
        expect(result.success).toBe(true);
        expect(result.pluginId).toBe('plugin-weather');
    });

    it('caches loaded plugins', async () => {
        const source: RemoteSource = { type: 'url', url: 'https://example.com/my-plugin.tar.gz' };
        await loader.load(source);

        expect(loader.isCached(source)).toBe(true);

        const cached = await loader.load(source);
        expect(cached.success).toBe(true);
        expect(cached.cached).toBe(true);
    });

    it('requires integrity when allowUnsigned=false', async () => {
        const strictLoader = new PluginRemoteLoader({ allowUnsigned: false });
        const source: RemoteSource = { type: 'url', url: 'https://example.com/plugin.tar.gz' };
        const result = await strictLoader.load(source);
        expect(result.success).toBe(false);
        expect(result.error).toContain('integrity');
    });

    it('allows with integrity hash', async () => {
        const strictLoader = new PluginRemoteLoader({ allowUnsigned: false });
        const source: RemoteSource = {
            type: 'url',
            url: 'https://example.com/plugin.tar.gz',
            integrity: 'abc123hash',
        };
        const result = await strictLoader.load(source);
        expect(result.success).toBe(true);
    });

    it('fails for URL source without url', async () => {
        const source: RemoteSource = { type: 'url' };
        const result = await loader.load(source);
        expect(result.success).toBe(false);
        expect(result.error).toContain('URL');
    });

    it('fails for NPM source without packageName', async () => {
        const source: RemoteSource = { type: 'npm' };
        const result = await loader.load(source);
        expect(result.success).toBe(false);
        expect(result.error).toContain('packageName');
    });

    it('clearCacheEntry removes from cache', async () => {
        const source: RemoteSource = { type: 'url', url: 'https://example.com/temp.tar.gz' };
        await loader.load(source);
        expect(loader.isCached(source)).toBe(true);
        loader.clearCacheEntry(source);
        expect(loader.isCached(source)).toBe(false);
    });

    it('clearCache removes all entries', async () => {
        await loader.load({ type: 'url', url: 'https://a.com/x.tar.gz' });
        await loader.load({ type: 'url', url: 'https://b.com/y.tar.gz' });
        expect(loader.listCache()).toHaveLength(2);
        loader.clearCache();
        expect(loader.listCache()).toHaveLength(0);
    });

    it('getStats reports cache info', async () => {
        await loader.load({ type: 'url', url: 'https://a.com/x.tar.gz' });
        const stats = loader.getStats();
        expect(stats.cacheEntries).toBe(1);
    });

    it('verifyIntegrity checks hash', async () => {
        const source: RemoteSource = { type: 'url', url: 'https://a.com/x.tar.gz', integrity: 'abc' };
        await loader.load(source);
        expect(loader.verifyIntegrity(source, 'abc')).toBe(true);
        expect(loader.verifyIntegrity(source, 'xyz')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// SignatureVerifier
// ═══════════════════════════════════════════════════════════════════

describe('SignatureVerifier', () => {
    let verifier: SignatureVerifier;

    beforeEach(() => { verifier = new SignatureVerifier(); });

    it('computes SHA-256 hash', () => {
        const hash1 = verifier.computeHash('hello world');
        const hash2 = verifier.computeHash('hello world');
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // sha256 hex length
    });

    it('different content produces different hashes', () => {
        expect(verifier.computeHash('a')).not.toBe(verifier.computeHash('b'));
    });

    it('verifies valid signature', () => {
        const content = 'plugin source code';
        const hash = verifier.computeHash(content);
        verifier.trustPublisher('coreblow', 'CoreBlow Team');
        verifier.registerSignature({
            pluginId: 'weather', version: '1.0.0',
            hash, publisher: 'coreblow',
            signedAt: Date.now(), algorithm: 'sha256',
        });

        const result = verifier.verify('weather', '1.0.0', content);
        expect(result.valid).toBe(true);
        expect(result.trusted).toBe(true);
        expect(result.reason).toBe('verified');
    });

    it('rejects hash mismatch', () => {
        verifier.registerSignature({
            pluginId: 'bad', version: '1.0.0',
            hash: 'expected-hash', publisher: 'unknown',
            signedAt: Date.now(), algorithm: 'sha256',
        });

        const result = verifier.verify('bad', '1.0.0', 'tampered content');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('hash-mismatch');
    });

    it('rejects unsigned plugin', () => {
        const result = verifier.verify('unknown', '1.0.0', 'content');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('no-signature');
    });

    it('marks untrusted publisher', () => {
        const content = 'code';
        const hash = verifier.computeHash(content);
        verifier.registerSignature({
            pluginId: 'sketchy', version: '1.0.0',
            hash, publisher: 'unknown-pub',
            signedAt: Date.now(), algorithm: 'sha256',
        });

        const result = verifier.verify('sketchy', '1.0.0', content);
        expect(result.valid).toBe(true);
        expect(result.trusted).toBe(false);
        expect(result.reason).toBe('untrusted-publisher');
    });

    it('manages trusted publishers', () => {
        verifier.trustPublisher('cb', 'CoreBlow');
        expect(verifier.isPublisherTrusted('cb')).toBe(true);
        expect(verifier.listTrustedPublishers()).toHaveLength(1);

        verifier.untrustPublisher('cb');
        expect(verifier.isPublisherTrusted('cb')).toBe(false);
    });

    it('revokes hashes', () => {
        const content = 'compromised';
        const hash = verifier.computeHash(content);
        verifier.registerSignature({
            pluginId: 'compromised', version: '1.0.0',
            hash, publisher: 'attacker',
            signedAt: Date.now(), algorithm: 'sha256',
        });

        verifier.revokeHash(hash);
        const result = verifier.verify('compromised', '1.0.0', content);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('hash-revoked');
    });

    it('isRevoked checks revocation', () => {
        verifier.revokeHash('abc');
        expect(verifier.isRevoked('abc')).toBe(true);
        expect(verifier.isRevoked('def')).toBe(false);
    });

    it('clear resets all data', () => {
        verifier.trustPublisher('x', 'X');
        verifier.revokeHash('y');
        verifier.clear();
        expect(verifier.listTrustedPublishers()).toHaveLength(0);
        expect(verifier.isRevoked('y')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginMigrationEngine
// ═══════════════════════════════════════════════════════════════════

describe('PluginMigrationEngine', () => {
    let engine: PluginMigrationEngine;

    beforeEach(() => { engine = new PluginMigrationEngine(); });

    it('registers and retrieves steps', () => {
        engine.registerSteps('weather', [
            { version: '1.1.0', description: 'Add units', up: (d) => ({ ...d, units: 'metric' }) },
        ]);
        expect(engine.getSteps('weather')).toHaveLength(1);
    });

    it('sorts steps by version', () => {
        engine.registerSteps('plugin', [
            { version: '2.0.0', description: 'v2', up: (d) => d },
            { version: '1.1.0', description: 'v1.1', up: (d) => d },
            { version: '1.5.0', description: 'v1.5', up: (d) => d },
        ]);
        const versions = engine.getSteps('plugin').map(s => s.version);
        expect(versions).toEqual(['1.1.0', '1.5.0', '2.0.0']);
    });

    it('migrates data through steps', async () => {
        engine.registerSteps('config', [
            { version: '1.1.0', description: 'add field', up: (d) => ({ ...d, newField: true }) },
            { version: '1.2.0', description: 'rename', up: (d) => ({ ...d, renamedField: d['oldField'] }) },
        ]);

        const result = await engine.migrate('config', '1.0.0', '1.2.0', { oldField: 'value' });
        expect(result.success).toBe(true);
        expect(result.stepsApplied).toEqual(['1.1.0', '1.2.0']);
        expect(result.data.newField).toBe(true);
        expect(result.data.renamedField).toBe('value');
    });

    it('skips steps outside version range', async () => {
        engine.registerSteps('plugin', [
            { version: '1.0.0', description: 'old', up: (d) => ({ ...d, old: true }) },
            { version: '2.0.0', description: 'new', up: (d) => ({ ...d, new: true }) },
            { version: '3.0.0', description: 'future', up: (d) => ({ ...d, future: true }) },
        ]);

        const result = await engine.migrate('plugin', '1.0.0', '2.0.0', {});
        expect(result.stepsApplied).toEqual(['2.0.0']);
        expect(result.data.new).toBe(true);
        expect(result.data.future).toBeUndefined();
    });

    it('dry run does not modify data', async () => {
        engine.registerSteps('plugin', [
            { version: '1.1.0', description: 'v1.1', up: (d) => ({ ...d, v: '1.1' }) },
        ]);

        const result = await engine.migrate('plugin', '1.0.0', '2.0.0', { original: true }, true);
        expect(result.dryRun).toBe(true);
        expect(result.stepsApplied).toEqual(['1.1.0']);
        expect(result.data.v).toBeUndefined(); // not applied
    });

    it('handles migration errors', async () => {
        engine.registerSteps('bad', [
            { version: '1.1.0', description: 'fail', up: () => { throw new Error('boom'); } },
        ]);

        const result = await engine.migrate('bad', '1.0.0', '2.0.0', {});
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('boom');
    });

    it('rollback reverses a step', async () => {
        engine.registerSteps('plugin', [{
            version: '1.1.0', description: 'add',
            up: (d) => ({ ...d, added: true }),
            down: (d) => { const { added, ...rest } = d as any; return rest; },
        }]);

        const result = await engine.rollback('plugin', '1.1.0', { added: true, keep: 'yes' });
        expect(result.success).toBe(true);
        expect(result.data.added).toBeUndefined();
        expect(result.data.keep).toBe('yes');
    });

    it('rollback fails without down function', async () => {
        engine.registerSteps('no-down', [
            { version: '1.1.0', description: 'no rollback', up: (d) => d },
        ]);

        const result = await engine.rollback('no-down', '1.1.0', {});
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('rollback');
    });

    it('needsMigration checks for pending steps', () => {
        engine.registerSteps('plugin', [
            { version: '1.1.0', description: 'v1.1', up: (d) => d },
        ]);

        expect(engine.needsMigration('plugin', '1.0.0', '2.0.0')).toBe(true);
        expect(engine.needsMigration('plugin', '1.1.0', '2.0.0')).toBe(false);
    });

    it('getPendingVersions returns applicable versions', () => {
        engine.registerSteps('plugin', [
            { version: '1.1.0', description: 'a', up: (d) => d },
            { version: '1.2.0', description: 'b', up: (d) => d },
            { version: '2.0.0', description: 'c', up: (d) => d },
        ]);

        expect(engine.getPendingVersions('plugin', '1.0.0', '1.2.0')).toEqual(['1.1.0', '1.2.0']);
    });

    it('tracks migration history', async () => {
        engine.registerSteps('plugin', [
            { version: '1.1.0', description: 'v1.1', up: (d) => d },
        ]);

        await engine.migrate('plugin', '1.0.0', '2.0.0', {});
        const history = engine.getHistory('plugin');
        expect(history).toHaveLength(1);
        expect(history[0].direction).toBe('up');
    });

    it('clear resets all data', () => {
        engine.registerSteps('a', [{ version: '1.0.0', description: 'x', up: (d) => d }]);
        engine.clear();
        expect(engine.getSteps('a')).toHaveLength(0);
    });
});
