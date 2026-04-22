import { describe, it, expect } from 'vitest';
import { resolveConfigSetMode } from './config-set-parser.js';

describe('resolveConfigSetMode', () => {
    it('returns "value" mode by default', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: false,
            hasRefBuilderOptions: false,
            hasProviderBuilderOptions: false,
            strictJson: false,
        });
        expect(result).toEqual({ ok: true, mode: 'value' });
    });

    it('returns "json" mode when strictJson', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: false,
            hasRefBuilderOptions: false,
            hasProviderBuilderOptions: false,
            strictJson: true,
        });
        expect(result).toEqual({ ok: true, mode: 'json' });
    });

    it('returns "batch" mode', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: true,
            hasRefBuilderOptions: false,
            hasProviderBuilderOptions: false,
            strictJson: false,
        });
        expect(result).toEqual({ ok: true, mode: 'batch' });
    });

    it('returns "ref_builder" mode', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: false,
            hasRefBuilderOptions: true,
            hasProviderBuilderOptions: false,
            strictJson: false,
        });
        expect(result).toEqual({ ok: true, mode: 'ref_builder' });
    });

    it('returns "provider_builder" mode', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: false,
            hasRefBuilderOptions: false,
            hasProviderBuilderOptions: true,
            strictJson: false,
        });
        expect(result).toEqual({ ok: true, mode: 'provider_builder' });
    });

    it('errors when batch combined with ref builder', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: true,
            hasRefBuilderOptions: true,
            hasProviderBuilderOptions: false,
            strictJson: false,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('batch');
    });

    it('errors when batch combined with provider builder', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: true,
            hasRefBuilderOptions: false,
            hasProviderBuilderOptions: true,
            strictJson: false,
        });
        expect(result.ok).toBe(false);
    });

    it('errors when ref and provider builders combined', () => {
        const result = resolveConfigSetMode({
            hasBatchMode: false,
            hasRefBuilderOptions: true,
            hasProviderBuilderOptions: true,
            strictJson: false,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('choose exactly one');
    });
});
