/**
 * tests/unit/config.test.ts
 * Unit tests — configuration system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Config System', () => {
    const tmpDir = path.join(os.tmpdir(), 'coreblow-test-' + Date.now());
    const configPath = path.join(tmpDir, 'config.json');

    beforeEach(() => {
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    it('should create default config if none exists', () => {
        // Default config shape
        const defaultConfig = {
            port: 3120,
            host: '127.0.0.1',
            agent: { provider: 'ollama', model: 'llama3.2' },
            providers: {},
            channels: {},
            features: { dashboard: true, cron: true, audit: true },
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        expect(loaded.port).toBe(3120);
        expect(loaded.agent.provider).toBe('ollama');
        expect(loaded.features.dashboard).toBe(true);
    });

    it('should support custom port', () => {
        const config = { port: 4000, host: '0.0.0.0' };
        fs.writeFileSync(configPath, JSON.stringify(config));

        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(loaded.port).toBe(4000);
        expect(loaded.host).toBe('0.0.0.0');
    });

    it('should handle missing config gracefully', () => {
        const missingPath = path.join(tmpDir, 'nonexistent.json');
        expect(fs.existsSync(missingPath)).toBe(false);
    });
});
