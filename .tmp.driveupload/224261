/**
 * CoreBlow — Dangerous Config Flags Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the config module to avoid deep dependency chains
vi.mock('../config/config.js', () => ({}));

import { collectEnabledInsecureOrDangerousFlags } from './dangerous-config-flags.js';

describe('collectEnabledInsecureOrDangerousFlags', () => {
    it('should return empty array for safe config', () => {
        const cfg = {} as any;
        expect(collectEnabledInsecureOrDangerousFlags(cfg)).toEqual([]);
    });

    it('should detect allowInsecureAuth', () => {
        const cfg = { gateway: { controlUi: { allowInsecureAuth: true } } } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('gateway.controlUi.allowInsecureAuth=true');
    });

    it('should detect dangerouslyAllowHostHeaderOriginFallback', () => {
        const cfg = { gateway: { controlUi: { dangerouslyAllowHostHeaderOriginFallback: true } } } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true');
    });

    it('should detect dangerouslyDisableDeviceAuth', () => {
        const cfg = { gateway: { controlUi: { dangerouslyDisableDeviceAuth: true } } } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('gateway.controlUi.dangerouslyDisableDeviceAuth=true');
    });

    it('should detect hooks.gmail.allowUnsafeExternalContent', () => {
        const cfg = { hooks: { gmail: { allowUnsafeExternalContent: true } } } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('hooks.gmail.allowUnsafeExternalContent=true');
    });

    it('should detect hooks.mappings[].allowUnsafeExternalContent', () => {
        const cfg = {
            hooks: { mappings: [{ allowUnsafeExternalContent: true }, { allowUnsafeExternalContent: false }] },
        } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('hooks.mappings[0].allowUnsafeExternalContent=true');
        expect(flags).not.toContain('hooks.mappings[1].allowUnsafeExternalContent=true');
    });

    it('should detect tools.exec.applyPatch.workspaceOnly=false', () => {
        const cfg = { tools: { exec: { applyPatch: { workspaceOnly: false } } } } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toContain('tools.exec.applyPatch.workspaceOnly=false');
    });

    it('should NOT flag undefined or false values', () => {
        const cfg = {
            gateway: { controlUi: { allowInsecureAuth: false } },
            tools: { exec: { applyPatch: { workspaceOnly: true } } },
        } as any;
        expect(collectEnabledInsecureOrDangerousFlags(cfg)).toEqual([]);
    });

    it('should collect multiple flags at once', () => {
        const cfg = {
            gateway: { controlUi: { allowInsecureAuth: true, dangerouslyDisableDeviceAuth: true } },
            hooks: { gmail: { allowUnsafeExternalContent: true } },
        } as any;
        const flags = collectEnabledInsecureOrDangerousFlags(cfg);
        expect(flags).toHaveLength(3);
    });
});
