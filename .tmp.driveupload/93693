/**
 * Tests: Plugin System — Manifest validation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseManifest, generateManifestTemplate } from '../../src/plugins/manifest.js';

describe('Plugin Manifest', () => {
    describe('parseManifest', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('parses valid plugin.json (name + version)', () => {
            // Create entry point so validation passes
            fs.writeFileSync(path.join(tmpDir, 'index.js'), 'module.exports={}');
            fs.writeFileSync(path.join(tmpDir, 'plugin.json'), JSON.stringify({
                name: 'test-plugin',
                version: '1.0.0',
                description: 'Test plugin',
                main: 'index.js',
            }));
            const result = parseManifest(tmpDir);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('returns invalid for empty dir', () => {
            const result = parseManifest(tmpDir);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('reports errors for missing name', () => {
            fs.writeFileSync(path.join(tmpDir, 'plugin.json'), JSON.stringify({
                version: '1.0.0',
            }));
            const result = parseManifest(tmpDir);
            expect(result.valid).toBe(false);
        });

        it('reports errors for missing version', () => {
            fs.writeFileSync(path.join(tmpDir, 'plugin.json'), JSON.stringify({
                name: 'test-plugin',
            }));
            const result = parseManifest(tmpDir);
            expect(result.valid).toBe(false);
        });
    });

    describe('generateManifestTemplate', () => {
        it('generates a template with name', () => {
            const template = generateManifestTemplate('my-plugin');
            expect(template.name).toBe('my-plugin');
            expect(template.version).toBe('1.0.0');
        });

        it('generates with required fields', () => {
            const template = generateManifestTemplate('test');
            expect(template.name).toBeDefined();
            expect(template.version).toBeDefined();
        });
    });
});
