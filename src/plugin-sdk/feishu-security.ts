// Manual facade. Keep loader boundary explicit.
import type { CoreBlowConfig } from "../config/config.js";
import type { SecurityAuditFinding } from "../security/audit.js";
import { loadBundledPluginPublicSurfaceModuleSync } from "./facade-loader.js";

type SecuritySurface = {
  collectFeishuSecurityAuditFindings: (params: { cfg: CoreBlowConfig }) => SecurityAuditFinding[];
};

function loadSecuritySurface(): SecuritySurface {
  return loadBundledPluginPublicSurfaceModuleSync<SecuritySurface>({
    dirName: "feishu",
    artifactBasename: "security-contract-api.js",
  });
}

export const collectFeishuSecurityAuditFindings: SecuritySurface["collectFeishuSecurityAuditFindings"] =
  ((...args) =>
    loadSecuritySurface().collectFeishuSecurityAuditFindings(
      ...args,
    )) as SecuritySurface["collectFeishuSecurityAuditFindings"];
