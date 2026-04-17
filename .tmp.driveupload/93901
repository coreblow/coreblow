/**
 * CoreBlow Phase 34 — Config→Secrets→Validation Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   ConfigValidator.validate → SecretWatcher.register → leak scan → rotation
 */
import { describe, it, expect } from 'vitest';
import { ConfigValidator, getNestedValue } from '../../src/gateway/config-validator.js';
import { SecretWatcher } from '../../src/config/secret-watcher.js';
import { EnvManager } from '../../src/config/env-manager.js';

describe('Phase34 Chain: Config→Secrets→Validation Pipeline', () => {

    it('load env → validate config → register secrets → scan for leaks', () => {
        // Step 1: Load environment
        const env = new EnvManager();
        env.define('PORT', 'number', false, 3100);
        env.define('OPENAI_KEY', 'string', true);
        env.define('ANTHROPIC_KEY', 'string', true);
        env.load({ OPENAI_KEY: 'sk-live-abc123', ANTHROPIC_KEY: 'ant-live-xyz789' });

        // Step 2: Build and validate config
        const validator = new ConfigValidator();
        const config: Record<string, unknown> = {
            port: env.get('PORT'),
            providers: {
                openai: { apiKey: env.get('OPENAI_KEY') },
                anthropic: { apiKey: env.get('ANTHROPIC_KEY') },
            },
        };
        const result = validator.validate(config);
        expect(result.valid).toBe(true);

        // Step 3: Register secrets
        const watcher = new SecretWatcher();
        watcher.register('openai', env.get<string>('OPENAI_KEY')!, 'openai');
        watcher.register('anthropic', env.get<string>('ANTHROPIC_KEY')!, 'anthropic');

        // Step 4: Scan user input for leaked secrets
        const userMessage = 'My key is sk-live-abc123, please check it';
        const leaks = watcher.scanForLeaks(userMessage);
        expect(leaks).toHaveLength(1);
        expect(leaks[0]?.key).toBe('openai');

        // Step 5: Clean message has no leaks
        expect(watcher.scanForLeaks('Normal user message')).toHaveLength(0);
    });

    it('config migration → revalidation → secrets re-registered', () => {
        const validator = new ConfigValidator();
        validator.addMigration({
            fromVersion: 1, toVersion: 2, description: 'Move apiKey to providers',
            migrate: (cfg) => {
                cfg.providers = { openai: { apiKey: cfg.apiKey } };
                delete cfg.apiKey;
                return cfg;
            },
        });

        // Old config format
        const oldConfig: Record<string, unknown> = { apiKey: 'sk-old-format' };
        const migrated = validator.migrate(oldConfig, 1, 2);

        // Verify migration
        expect(getNestedValue(migrated, 'providers.openai.apiKey')).toBe('sk-old-format');
        expect(migrated.apiKey).toBeUndefined();

        // Re-validate migrated config
        const result = validator.validate(migrated);
        expect(result.valid).toBe(true);
    });

    it('secret rotation → verify new secret → old secret no longer leaks', () => {
        const watcher = new SecretWatcher();
        watcher.register('api-key', 'old-secret-value123', 'service');

        // Rotate
        watcher.rotate('api-key', 'new-secret-value456');

        // Old value no longer in scan
        const oldLeaks = watcher.scanForLeaks('text with old-secret-value123');
        expect(oldLeaks).toHaveLength(0); // Old value replaced

        // New value detected as leak
        const newLeaks = watcher.scanForLeaks('text with new-secret-value456');
        expect(newLeaks).toHaveLength(1);
    });
});
