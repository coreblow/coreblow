/**
 * plugins/manifest.test.ts — Plugin manifest tests
 */
import { describe, it, expect } from 'vitest';
import { parseManifest, generateManifestTemplate } from './manifest.js';

describe('Plugin Manifest', () => {
    it('should generate manifest template', () => {
        const template = generateManifestTemplate('my-plugin');
        expect(template.name).toBe('my-plugin');
        expect(template.version).toBeDefined();
    });

    it('should reject invalid manifest path', () => {
        const result = parseManifest('/nonexistent/path');
        expect(result.valid).toBe(false);
    });
});
