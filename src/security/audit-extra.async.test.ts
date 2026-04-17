/**
 * CoreBlow — Audit Extra Async Pure Helper Tests
 *
 * Tests pure helper functions extracted from audit-extra.async.ts.
 * The main async collector functions require deep gateway/agent/sandbox
 * dependencies and are tested via integration tests.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock ALL deep dependencies
vi.mock('node:fs/promises', () => ({
    default: { readFile: vi.fn(), readdir: vi.fn(), lstat: vi.fn(), stat: vi.fn(), realpath: vi.fn() },
}));
vi.mock('../agents/agent-scope.js', () => ({ resolveDefaultAgentId: vi.fn() }));
vi.mock('../agents/sandbox/config.js', () => ({ resolveSandboxConfigForAgent: vi.fn(() => ({ mode: 'off' })) }));
vi.mock('../agents/sandbox/constants.js', () => ({ SANDBOX_BROWSER_SECURITY_HASH_EPOCH: 'test-epoch' }));
vi.mock('../agents/sandbox/docker.js', () => ({ execDockerRaw: vi.fn() }));
vi.mock('../agents/sandbox/tool-policy.js', () => ({ resolveSandboxToolPolicyForAgent: vi.fn() }));
vi.mock('../agents/tool-policy-match.js', () => ({ isToolAllowedByPolicies: vi.fn(() => false) }));
vi.mock('../agents/tool-policy.js', () => ({ resolveToolProfilePolicy: vi.fn() }));
vi.mock('../agents/workspace-dirs.js', () => ({ listAgentWorkspaceDirs: vi.fn(async () => []) }));
vi.mock('../cli/command-format.js', () => ({ formatCliCommand: (cmd: string) => cmd }));
vi.mock('../compat/legacy-names.js', () => ({ MANIFEST_KEY: 'coreblow' }));
vi.mock('../config/commands.js', () => ({ resolveNativeSkillsEnabled: vi.fn(() => false) }));
vi.mock('../config/config.js', () => ({}));
vi.mock('../config/includes-scan.js', () => ({ collectIncludePathsRecursive: vi.fn(async () => []) }));
vi.mock('../config/paths.js', () => ({ resolveOAuthDir: vi.fn(() => '/tmp/oauth') }));
vi.mock('../config/types.secrets.js', () => ({ hasConfiguredSecretInput: vi.fn(() => false) }));
vi.mock('../plugins/config-state.js', () => ({ normalizePluginsConfig: vi.fn(() => ({ enabled: false, allow: [], deny: [], entries: {} })) }));
vi.mock('../routing/session-key.js', () => ({ normalizeAgentId: vi.fn() }));
vi.mock('./audit-fs.js', () => ({
    formatPermissionDetail: vi.fn(),
    formatPermissionRemediation: vi.fn(),
    inspectPathPermissions: vi.fn(async () => ({ ok: true })),
    safeStat: vi.fn(async () => ({ ok: false, isDir: false, isSymlink: false })),
}));
vi.mock('./audit-tool-policy.js', () => ({ pickSandboxToolPolicy: vi.fn() }));
vi.mock('./scan-paths.js', () => ({ extensionUsesSkippedScannerPath: vi.fn(() => false), isPathInside: vi.fn(() => true) }));
vi.mock('./skill-scanner.js', () => ({ scanDirectoryWithSummary: vi.fn(async () => ({ findings: [], scannedFiles: 0 })) }));
vi.mock('./windows-acl.js', () => ({}));

import * as auditExtraAsync from './audit-extra.async.js';

describe('audit-extra.async', () => {
    it('should export collectSandboxBrowserHashLabelFindings', () => {
        expect(auditExtraAsync.collectSandboxBrowserHashLabelFindings).toBeDefined();
        expect(typeof auditExtraAsync.collectSandboxBrowserHashLabelFindings).toBe('function');
    });

    it('should export collectPluginsTrustFindings', () => {
        expect(auditExtraAsync.collectPluginsTrustFindings).toBeDefined();
    });

    it('should export collectInstalledSkillsCodeSafetyFindings', () => {
        expect(auditExtraAsync.collectInstalledSkillsCodeSafetyFindings).toBeDefined();
    });

    it('should export collectPluginsCodeSafetyFindings', () => {
        expect(auditExtraAsync.collectPluginsCodeSafetyFindings).toBeDefined();
    });

    it('should export collectStateDeepFilesystemFindings', () => {
        expect(auditExtraAsync.collectStateDeepFilesystemFindings).toBeDefined();
    });

    it('should export collectWorkspaceSkillSymlinkEscapeFindings', () => {
        expect(auditExtraAsync.collectWorkspaceSkillSymlinkEscapeFindings).toBeDefined();
    });

    it('should export collectIncludeFilePermFindings', () => {
        expect(auditExtraAsync.collectIncludeFilePermFindings).toBeDefined();
    });

    it('should export readConfigSnapshotForAudit', () => {
        expect(auditExtraAsync.readConfigSnapshotForAudit).toBeDefined();
    });

    it('collectSandboxBrowserHashLabelFindings should return empty for no containers', async () => {
        const mockExec = vi.fn(async () => ({ code: 1, stdout: Buffer.from(''), stderr: Buffer.from('') }));
        const findings = await auditExtraAsync.collectSandboxBrowserHashLabelFindings({
            execDockerRawFn: mockExec as any,
        });
        expect(findings).toEqual([]);
    });

    it('collectPluginsTrustFindings should return empty for no plugins dir', async () => {
        const findings = await auditExtraAsync.collectPluginsTrustFindings({
            cfg: {} as any,
            stateDir: '/nonexistent',
        });
        expect(findings).toEqual([]);
    });
});
