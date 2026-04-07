import type { SafeBinProfileFixture } from "../infra/exec-safe-bin-policy.js";

export type ExecToolConfig = {
  host?: "sandbox" | "gateway" | "node";
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
  node?: string;
  pathPrepend?: string[];
  safeBins?: string[];
  strictInlineEval?: boolean;
  safeBinTrustedDirs?: string[];
  safeBinProfiles?: Record<string, SafeBinProfileFixture>;
  backgroundMs?: number;
  timeoutSec?: number;
  approvalRunningNoticeMs?: number;
  cleanupMs?: number;
  notifyOnExit?: boolean;
  notifyOnExitEmptySuccess?: boolean;
};

export type AgentToolsConfig = {
  profile?: string;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
  exec?: ExecToolConfig;
};

export type ToolsConfig = {
  profile?: string;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
  exec?: ExecToolConfig;
};

export type CoreBlowConfig = {
  version?: number;
  tools?: ToolsConfig;
  agents?: Record<string, {
    tools?: AgentToolsConfig;
    [key: string]: unknown;
  }>;
  gateway?: {
    mode?: "remote" | "local";
    tls?: { enabled?: boolean };
    remote?: { token?: string; password?: string };
  };
  browser?: unknown;
  nodeHost?: {
    browserProxy?: { enabled?: boolean };
  };
  [key: string]: unknown;
};

export function loadConfig(): CoreBlowConfig {
  return {};
}
