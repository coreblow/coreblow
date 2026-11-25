import type { CoreBlowConfig } from "../config/types.coreblow.js";
import type { BundleMcpDiagnostic } from "../plugins/bundle-mcp.js";

export type CodexMcpServersConfig = Record<string, Record<string, unknown>>;

export type CodexBundleMcpThreadConfig = {
  configPatch?: {
    mcp_servers: CodexMcpServersConfig;
  };
  diagnostics: BundleMcpDiagnostic[];
  evaluated: boolean;
  fingerprint?: string;
};

export type LoadCodexBundleMcpThreadConfigParams = {
  workspaceDir: string;
  cfg?: CoreBlowConfig;
  toolsEnabled?: boolean;
  disableTools?: boolean;
  toolsAllow?: string[];
};
