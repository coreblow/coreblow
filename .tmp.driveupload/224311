/**
 * CoreBlow — Audit Extra (barrel) Re-export Tests
 */
import { describe, it, expect, vi } from 'vitest';

// Mock both source modules to avoid deep dependency chains
vi.mock('./audit-extra.sync.js', () => ({
    collectAttackSurfaceSummaryFindings: vi.fn(),
    collectExposureMatrixFindings: vi.fn(),
    collectGatewayHttpNoAuthFindings: vi.fn(),
    collectGatewayHttpSessionKeyOverrideFindings: vi.fn(),
    collectHooksHardeningFindings: vi.fn(),
    collectLikelyMultiUserSetupFindings: vi.fn(),
    collectMinimalProfileOverrideFindings: vi.fn(),
    collectModelHygieneFindings: vi.fn(),
    collectNodeDangerousAllowCommandFindings: vi.fn(),
    collectNodeDenyCommandPatternFindings: vi.fn(),
    collectSandboxDangerousConfigFindings: vi.fn(),
    collectSandboxDockerNoopFindings: vi.fn(),
    collectSecretsInConfigFindings: vi.fn(),
    collectSmallModelRiskFindings: vi.fn(),
    collectSyncedFolderFindings: vi.fn(),
}));

vi.mock('./audit-extra.async.js', () => ({
    collectSandboxBrowserHashLabelFindings: vi.fn(),
    collectIncludeFilePermFindings: vi.fn(),
    collectInstalledSkillsCodeSafetyFindings: vi.fn(),
    collectPluginsCodeSafetyFindings: vi.fn(),
    collectPluginsTrustFindings: vi.fn(),
    collectStateDeepFilesystemFindings: vi.fn(),
    collectWorkspaceSkillSymlinkEscapeFindings: vi.fn(),
    readConfigSnapshotForAudit: vi.fn(),
}));

import * as auditExtra from './audit-extra.js';

describe('audit-extra barrel', () => {
    it('should re-export sync collectors', () => {
        expect(auditExtra.collectAttackSurfaceSummaryFindings).toBeDefined();
        expect(auditExtra.collectGatewayHttpNoAuthFindings).toBeDefined();
        expect(auditExtra.collectSandboxDangerousConfigFindings).toBeDefined();
        expect(auditExtra.collectSecretsInConfigFindings).toBeDefined();
    });

    it('should re-export async collectors', () => {
        expect(auditExtra.collectSandboxBrowserHashLabelFindings).toBeDefined();
        expect(auditExtra.collectPluginsTrustFindings).toBeDefined();
        expect(auditExtra.collectInstalledSkillsCodeSafetyFindings).toBeDefined();
        expect(auditExtra.readConfigSnapshotForAudit).toBeDefined();
    });

    it('should re-export all 15 sync + 8 async collectors', () => {
        const syncNames = [
            'collectAttackSurfaceSummaryFindings',
            'collectExposureMatrixFindings',
            'collectGatewayHttpNoAuthFindings',
            'collectGatewayHttpSessionKeyOverrideFindings',
            'collectHooksHardeningFindings',
            'collectLikelyMultiUserSetupFindings',
            'collectMinimalProfileOverrideFindings',
            'collectModelHygieneFindings',
            'collectNodeDangerousAllowCommandFindings',
            'collectNodeDenyCommandPatternFindings',
            'collectSandboxDangerousConfigFindings',
            'collectSandboxDockerNoopFindings',
            'collectSecretsInConfigFindings',
            'collectSmallModelRiskFindings',
            'collectSyncedFolderFindings',
        ];
        const asyncNames = [
            'collectSandboxBrowserHashLabelFindings',
            'collectIncludeFilePermFindings',
            'collectInstalledSkillsCodeSafetyFindings',
            'collectPluginsCodeSafetyFindings',
            'collectPluginsTrustFindings',
            'collectStateDeepFilesystemFindings',
            'collectWorkspaceSkillSymlinkEscapeFindings',
            'readConfigSnapshotForAudit',
        ];
        for (const name of [...syncNames, ...asyncNames]) {
            expect((auditExtra as any)[name]).toBeDefined();
        }
    });
});
