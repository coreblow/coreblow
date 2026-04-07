/**
 * config/schema.shared.test.ts — Config schema shared utilities tests
 */
import { describe, it, expect } from 'vitest';
import { isConfigSection, normalizeConfigKey, diffConfigKeys, CONFIG_SECTIONS } from './schema.shared.js';

describe('Config Schema Shared', () => {
    it('should validate config sections', () => {
        expect(isConfigSection('gateway')).toBe(true);
        expect(isConfigSection('models')).toBe(true);
        expect(isConfigSection('invalid')).toBe(false);
    });

    it('should normalize config keys', () => {
        expect(normalizeConfigKey('agents[0].name')).toBe('agents.0.name');
        expect(normalizeConfigKey('.gateway')).toBe('gateway');
    });

    it('should diff config keys', () => {
        const a = { gateway: { port: 3577 }, models: {} };
        const b = { gateway: { port: 4000 }, models: {} };
        const changed = diffConfigKeys(a, b);
        expect(changed).toContain('gateway');
        expect(changed).not.toContain('models');
    });

    it('should define standard sections', () => {
        expect(CONFIG_SECTIONS.length).toBeGreaterThan(5);
        expect(CONFIG_SECTIONS).toContain('gateway');
    });
});
