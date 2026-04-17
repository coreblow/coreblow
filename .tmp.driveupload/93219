/**
 * plugins/manifest.schema.test.ts
 * Tests for plugin manifest Zod schema.
 */
import { describe, it, expect } from 'vitest';
import {
    validatePluginManifest,
    safeValidatePluginManifest,
} from './manifest.schema.js';

describe('PluginManifestSchema', () => {
    const validManifest = {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'A cool plugin',
        entrypoint: 'index.js',
    };

    it('should accept a minimal valid manifest', () => {
        const result = validatePluginManifest(validManifest);
        expect(result.name).toBe('my-plugin');
        expect(result.version).toBe('1.0.0');
        expect(result.permissions).toEqual([]);
        expect(result.entrypoint).toBe('index.js');
    });

    it('should reject empty name', () => {
        const result = safeValidatePluginManifest({ ...validManifest, name: '' });
        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject invalid semver', () => {
        const result = safeValidatePluginManifest({ ...validManifest, version: 'abc' });
        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.includes('semver'))).toBe(true);
    });

    it('should accept pre-release semver', () => {
        const result = validatePluginManifest({ ...validManifest, version: '2.0.0-beta.1' });
        expect(result.version).toBe('2.0.0-beta.1');
    });

    it('should accept valid permissions', () => {
        const result = validatePluginManifest({
            ...validManifest,
            permissions: ['fs', 'network', 'exec'],
        });
        expect(result.permissions).toEqual(['fs', 'network', 'exec']);
    });

    it('should reject invalid permissions', () => {
        const result = safeValidatePluginManifest({
            ...validManifest,
            permissions: ['fly'],
        });
        expect(result.success).toBe(false);
    });

    it('should accept tools array', () => {
        const result = validatePluginManifest({
            ...validManifest,
            tools: [
                { name: 'search', description: 'Search the web' },
                { name: 'calc' },
            ],
        });
        expect(result.tools).toHaveLength(2);
        expect(result.tools![0].name).toBe('search');
    });

    it('should reject tool with empty name', () => {
        const result = safeValidatePluginManifest({
            ...validManifest,
            tools: [{ name: '' }],
        });
        expect(result.success).toBe(false);
    });

    it('should accept hooks array', () => {
        const result = validatePluginManifest({
            ...validManifest,
            hooks: [{ event: 'message', handler: 'onMessage', priority: 50 }],
        });
        expect(result.hooks).toHaveLength(1);
        expect(result.hooks![0].priority).toBe(50);
    });

    it('should default hook priority to 100', () => {
        const result = validatePluginManifest({
            ...validManifest,
            hooks: [{ event: 'startup', handler: 'onStart' }],
        });
        expect(result.hooks![0].priority).toBe(100);
    });

    it('should default entrypoint to index.js', () => {
        const result = validatePluginManifest({ name: 'test', version: '1.0.0' });
        expect(result.entrypoint).toBe('index.js');
    });

    it('should accept full manifest with all fields', () => {
        const full = {
            name: 'enterprise-plugin',
            version: '3.2.1',
            description: 'Enterprise monitoring plugin',
            author: 'CoreBlow Team',
            license: 'MIT',
            homepage: 'https://coreblow.com/plugins/enterprise',
            permissions: ['fs', 'network'] as const,
            tools: [{ name: 'monitor', description: 'System monitor' }],
            hooks: [{ event: 'heartbeat', handler: 'onHeartbeat' }],
            commands: [{ name: 'status', description: 'Show status', aliases: ['s'] }],
            entrypoint: 'dist/index.js',
            minGatewayVersion: '1.0.0',
        };
        const result = validatePluginManifest(full);
        expect(result.name).toBe('enterprise-plugin');
        expect(result.commands).toHaveLength(1);
    });

    it('should reject name over 100 chars', () => {
        const result = safeValidatePluginManifest({
            ...validManifest,
            name: 'x'.repeat(101),
        });
        expect(result.success).toBe(false);
    });
});
