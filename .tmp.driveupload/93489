/**
 * CoreBlow Phase 32 — ServiceRegistry & EnvManager Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ServiceRegistry: dependency resolution, start/stop lifecycle, health
 *   - EnvManager: type coercion, env file parsing, validation, getOrDefault
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../../src/gateway/service-registry.js';
import { EnvManager } from '../../src/config/env-manager.js';

// ================================================================
describe('ServiceRegistry — Extended', () => {
    let reg: ServiceRegistry;
    beforeEach(() => { reg = new ServiceRegistry(); });

    it('should resolve registered service instances', () => {
        const instance = { connected: true, pool: 5 };
        reg.register('db', instance);
        expect(reg.resolve('db')).toEqual(instance);
    });

    it('should return null for unregistered service', () => {
        expect(reg.resolve('ghost')).toBeNull();
    });

    it('should enforce dependency order', () => {
        reg.register('gateway', {}, ['agents']);
        reg.register('agents', {}, ['config']);
        reg.register('config', {});

        // Can't start gateway without agents started
        expect(reg.start('gateway')).toBe(false);
        // Can't start agents without config started
        expect(reg.start('agents')).toBe(false);
        // Config has no deps
        expect(reg.start('config')).toBe(true);
        // Now agents can start
        expect(reg.start('agents')).toBe(true);
        // Now gateway can start
        expect(reg.start('gateway')).toBe(true);
    });

    it('should start all in dependency order', () => {
        reg.register('c', {}, ['b']);
        reg.register('b', {}, ['a']);
        reg.register('a', {});

        const result = reg.startAll();
        expect(result.started).toEqual(['a', 'b', 'c']);
        expect(result.failed).toHaveLength(0);
    });

    it('should stop a running service', () => {
        reg.register('svc', {});
        reg.start('svc');
        expect(reg.stop('svc')).toBe(true);

        const health = reg.getHealth();
        expect(health.find(h => h.name === 'svc')?.status).toBe('stopped');
    });

    it('should report health with uptime', () => {
        reg.register('a', {});
        reg.start('a');

        const health = reg.getHealth();
        expect(health).toHaveLength(1);
        expect(health[0]?.status).toBe('started');
        expect(health[0]?.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should list services with dependencies', () => {
        reg.register('api', {}, ['db', 'cache']);
        reg.register('db', {});
        reg.register('cache', {});

        const list = reg.list();
        expect(list).toHaveLength(3);
        expect(list.find(s => s.name === 'api')?.deps).toEqual(['db', 'cache']);
    });

    it('should handle missing dependency in startAll', () => {
        reg.register('broken', {}, ['nonexistent']);
        const result = reg.startAll();
        expect(result.failed).toContain('nonexistent');
        expect(result.failed).toContain('broken');
    });
});

// ================================================================
describe('EnvManager — Extended', () => {
    let env: EnvManager;
    beforeEach(() => {
        env = new EnvManager();
        env.define('PORT', 'number', false, 3000);
        env.define('API_KEY', 'string', true);
        env.define('DEBUG', 'boolean', false, false);
        env.define('HOST', 'string', false, 'localhost');
    });

    it('should load with defaults for optional vars', () => {
        const result = env.load({ API_KEY: 'sk-123' });
        expect(result.valid).toBe(true);
        expect(env.get('PORT')).toBe(3000);
        expect(env.get('DEBUG')).toBe(false);
        expect(env.get('HOST')).toBe('localhost');
    });

    it('should coerce string to number', () => {
        env.load({ PORT: '8080', API_KEY: 'key' });
        expect(env.get('PORT')).toBe(8080);
    });

    it('should coerce string to boolean', () => {
        env.load({ DEBUG: 'true', API_KEY: 'key' });
        expect(env.get('DEBUG')).toBe(true);

        env.load({ DEBUG: '1', API_KEY: 'key' });
        expect(env.get('DEBUG')).toBe(true);

        env.load({ DEBUG: 'false', API_KEY: 'key' });
        expect(env.get('DEBUG')).toBe(false);
    });

    it('should error on missing required var', () => {
        const result = env.load({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('API_KEY');
    });

    it('should error on invalid number', () => {
        const result = env.load({ PORT: 'abc', API_KEY: 'key' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('PORT');
    });

    it('should parse .env file content', () => {
        const content = [
            'PORT=3000',
            'API_KEY="secret-key"',
            '# This is a comment',
            "HOST='localhost'",
            '',
            'DEBUG=true',
        ].join('\n');

        const parsed = env.parseEnvFile(content);
        expect(parsed.PORT).toBe('3000');
        expect(parsed.API_KEY).toBe('secret-key');
        expect(parsed.HOST).toBe('localhost');
        expect(parsed.DEBUG).toBe('true');
    });

    it('should set and get arbitrary values', () => {
        env.set('CUSTOM', 'my-value');
        expect(env.get('CUSTOM')).toBe('my-value');
    });

    it('should use getOrDefault for missing keys', () => {
        expect(env.getOrDefault('MISSING', 'fallback')).toBe('fallback');
        env.set('EXISTS', 'real-value');
        expect(env.getOrDefault('EXISTS', 'fallback')).toBe('real-value');
    });

    it('should list definitions with hasValue flag', () => {
        env.load({ API_KEY: 'key' });
        const list = env.list();
        expect(list).toHaveLength(4);
        expect(list.find(d => d.key === 'API_KEY')?.hasValue).toBe(true);
    });
});
