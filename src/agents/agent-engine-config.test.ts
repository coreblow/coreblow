import { describe, it, expect } from 'vitest';
import {
    ANTHROPIC_PROVIDER,
    OPENAI_PROVIDER,
    DEFAULT_TOOL_APPROVAL,
    DEFAULT_ENGINE_CONFIG,
    mergeEngineConfig,
} from './agent-engine-config.js';

describe('Provider Configs', () => {
    it('ANTHROPIC_PROVIDER has expected shape', () => {
        expect(ANTHROPIC_PROVIDER.id).toBe('anthropic');
        expect(ANTHROPIC_PROVIDER.name).toBe('Anthropic');
        expect(ANTHROPIC_PROVIDER.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
        expect(ANTHROPIC_PROVIDER.models.length).toBeGreaterThan(0);
        expect(ANTHROPIC_PROVIDER.defaultModel).toBe('claude-sonnet-4-20250514');
    });

    it('OPENAI_PROVIDER has expected shape', () => {
        expect(OPENAI_PROVIDER.id).toBe('openai');
        expect(OPENAI_PROVIDER.name).toBe('OpenAI');
        expect(OPENAI_PROVIDER.apiKeyEnvVar).toBe('OPENAI_API_KEY');
        expect(OPENAI_PROVIDER.models).toContain('gpt-4o');
    });
});

describe('DEFAULT_TOOL_APPROVAL', () => {
    it('defaults to require_approval', () => {
        expect(DEFAULT_TOOL_APPROVAL.defaultMode).toBe('require_approval');
    });

    it('auto-approves read-only tools', () => {
        expect(DEFAULT_TOOL_APPROVAL.autoApproveTools).toContain('read_file');
        expect(DEFAULT_TOOL_APPROVAL.autoApproveTools).toContain('list_dir');
        expect(DEFAULT_TOOL_APPROVAL.autoApproveTools).toContain('view_file');
    });

    it('requires approval for write/exec tools', () => {
        expect(DEFAULT_TOOL_APPROVAL.requireApprovalTools).toContain('bash');
        expect(DEFAULT_TOOL_APPROVAL.requireApprovalTools).toContain('write_file');
        expect(DEFAULT_TOOL_APPROVAL.requireApprovalTools).toContain('run_command');
    });

    it('has empty deny list by default', () => {
        expect(DEFAULT_TOOL_APPROVAL.denyTools).toEqual([]);
    });
});

describe('DEFAULT_ENGINE_CONFIG', () => {
    it('has sensible defaults', () => {
        expect(DEFAULT_ENGINE_CONFIG.defaultProvider).toBe('anthropic');
        expect(DEFAULT_ENGINE_CONFIG.maxContextTokens).toBe(200_000);
        expect(DEFAULT_ENGINE_CONFIG.maxOutputTokens).toBe(8_192);
        expect(DEFAULT_ENGINE_CONFIG.maxTurnsPerSession).toBe(100);
        expect(DEFAULT_ENGINE_CONFIG.enableStreaming).toBe(true);
        expect(DEFAULT_ENGINE_CONFIG.enableCompaction).toBe(true);
        expect(DEFAULT_ENGINE_CONFIG.enableToolLoopDetection).toBe(true);
    });

    it('includes both providers', () => {
        expect(DEFAULT_ENGINE_CONFIG.providers).toHaveLength(2);
    });

    it('has compaction threshold at 80%', () => {
        expect(DEFAULT_ENGINE_CONFIG.compactionThreshold).toBe(0.8);
    });
});

describe('mergeEngineConfig', () => {
    it('returns defaults when no overrides', () => {
        const config = mergeEngineConfig();
        expect(config).toEqual(DEFAULT_ENGINE_CONFIG);
    });

    it('overrides specific fields', () => {
        const config = mergeEngineConfig({
            maxContextTokens: 100_000,
            enableStreaming: false,
        });
        expect(config.maxContextTokens).toBe(100_000);
        expect(config.enableStreaming).toBe(false);
        // Non-overridden fields stay default
        expect(config.defaultProvider).toBe('anthropic');
    });

    it('overrides provider', () => {
        const config = mergeEngineConfig({ defaultProvider: 'openai' });
        expect(config.defaultProvider).toBe('openai');
    });

    it('overrides tool approval config', () => {
        const custom = { ...DEFAULT_TOOL_APPROVAL, defaultMode: 'auto' as const };
        const config = mergeEngineConfig({ toolApproval: custom });
        expect(config.toolApproval.defaultMode).toBe('auto');
    });
});
