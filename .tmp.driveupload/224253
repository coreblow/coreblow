/**
 * CoreBlow — Audit Channel Pure Helper Tests
 *
 * Tests only the pure, extractable helper functions from audit-channel.ts.
 * The main collectChannelSecurityFindings function requires deep gateway/plugin
 * dependencies and is tested via integration tests.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock ALL external dependencies to isolate pure helpers
vi.mock('../channels/account-snapshot-fields.js', () => ({
    hasConfiguredUnavailableCredentialStatus: vi.fn(),
    hasResolvedCredentialValue: vi.fn(),
}));
vi.mock('../channels/plugins/helpers.js', () => ({
    resolveChannelDefaultAccountId: vi.fn(),
}));
vi.mock('../channels/read-only-account-inspect.js', () => ({
    inspectReadOnlyChannelAccount: vi.fn(),
}));
vi.mock('../cli/command-format.js', () => ({
    formatCliCommand: (cmd: string) => cmd,
}));
vi.mock('../config/commands.js', () => ({
    resolveNativeCommandsEnabled: vi.fn(() => false),
    resolveNativeSkillsEnabled: vi.fn(() => false),
}));
vi.mock('../config/config.js', () => ({}));
vi.mock('../config/dangerous-name-matching.js', () => ({
    isDangerousNameMatchingEnabled: vi.fn(() => false),
}));
vi.mock('../infra/errors.js', () => ({
    formatErrorMessage: (e: any) => String(e),
}));
vi.mock('../shared/lazy-runtime.js', () => ({
    createLazyRuntimeSurface: () => vi.fn(async () => ({})),
}));
vi.mock('../shared/string-normalization.js', () => ({
    normalizeStringEntries: (arr: any) => (arr || []).map(String),
}));
vi.mock('./audit.js', () => ({}));
vi.mock('./dm-policy-shared.js', () => ({
    resolveDmAllowState: vi.fn(async () => ({ hasWildcard: false, isMultiUserDm: false })),
}));

// Now import — the module should load with all deps mocked
import * as auditChannel from './audit-channel.js';

describe('audit-channel', () => {
    it('should export collectChannelSecurityFindings function', () => {
        expect(auditChannel.collectChannelSecurityFindings).toBeDefined();
        expect(typeof auditChannel.collectChannelSecurityFindings).toBe('function');
    });

    it('should return empty findings for empty plugins list', async () => {
        const findings = await auditChannel.collectChannelSecurityFindings({
            cfg: {} as any,
            plugins: [],
        });
        expect(findings).toEqual([]);
    });

    it('should return empty findings for plugins without security config', async () => {
        const findings = await auditChannel.collectChannelSecurityFindings({
            cfg: {} as any,
            plugins: [
                {
                    id: 'test',
                    meta: { label: 'Test' },
                    config: {
                        listAccountIds: () => [],
                        resolveAccount: () => ({}),
                    },
                    security: null, // No security config
                },
            ] as any,
        });
        expect(findings).toEqual([]);
    });
});
