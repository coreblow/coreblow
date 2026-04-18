import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
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
  agents?: {
    defaults?: {
      model?: string | { primary?: string };
      models?: Record<string, unknown>;
      tools?: AgentToolsConfig;
      thinkingDefault?: string;
      subagents?: { model?: string };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  gateway?: {
    mode?: "remote" | "local";
    bind?: string;
    auth?: { token?: string };
    tls?: { enabled?: boolean };
    remote?: { token?: string; password?: string };
  };
  models?: {
    providers?: Record<string, {
      models?: Array<{
        id: string;
        name?: string;
        contextWindow?: number;
        reasoning?: boolean;
        input?: string[];
      }>;
    }>;
  };
  hooks?: {
    gmail?: { model?: string };
    internal?: { enabled?: boolean };
  };
  browser?: unknown;
  nodeHost?: {
    browserProxy?: { enabled?: boolean };
  };
  [key: string]: unknown;
};

/**
 * Load CoreBlow configuration from ~/.coreblow/coreblow.json.
 *
 * Follows OpenClaw's loadConfig() pattern:
 *   1. Check COREBLOW_CONFIG_DIR env for custom path
 *   2. Fall back to ~/.coreblow/
 *   3. Read coreblow.json, return {} if missing/invalid
 */
export function loadConfig(): CoreBlowConfig {
  const configDir = process.env.COREBLOW_CONFIG_DIR
    ?? path.join(os.homedir(), '.coreblow');
  const configPath = path.join(configDir, 'coreblow.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as CoreBlowConfig;
  } catch {
    // Config file missing or malformed — return empty config.
    // This is expected on first run before onboarding.
    return {};
  }
}

