import fs from "node:fs/promises";
import path from "node:path";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { MigrationProviderPlugin } from "../plugin-sdk/plugin-entry.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";

export type SetupMigrationDetection = {
  providerId: string;
  label: string;
  source?: string;
  message?: string;
};

const MEANINGFUL_CONFIG_IGNORED_KEYS = new Set(["$schema", "meta"]);
const MEANINGFUL_WORKSPACE_ENTRIES = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "MEMORY.md",
  "skills",
] as const;
const MEANINGFUL_STATE_ENTRIES = ["credentials", "sessions", "agents"] as const;

async function exists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function hasDirectoryEntries(candidate: string): Promise<boolean> {
  try {
    return (await fs.readdir(candidate)).length > 0;
  } catch {
    return false;
  }
}

function hasMeaningfulConfig(config: CoreBlowConfig): boolean {
  return Object.keys(config as Record<string, unknown>).some(
    (key) => !MEANINGFUL_CONFIG_IGNORED_KEYS.has(key),
  );
}

export async function inspectSetupMigrationFreshness(params: {
  baseConfig: CoreBlowConfig;
  stateDir: string;
  workspaceDir: string;
}): Promise<{ fresh: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  if (hasMeaningfulConfig(params.baseConfig)) {
    reasons.push("existing config values are loaded");
  }
  for (const entry of MEANINGFUL_WORKSPACE_ENTRIES) {
    if (await exists(path.join(params.workspaceDir, entry))) {
      reasons.push(`workspace ${entry} exists`);
    }
  }
  for (const entry of MEANINGFUL_STATE_ENTRIES) {
    if (await hasDirectoryEntries(path.join(params.stateDir, entry))) {
      reasons.push(`state ${entry}/ exists`);
    }
  }
  return { fresh: reasons.length === 0, reasons };
}

export async function detectSetupMigrationSources(_params: {
  config: CoreBlowConfig;
  runtime: RuntimeEnv;
}): Promise<SetupMigrationDetection[]> {
  return [];
}

export async function runSetupMigrationImport(_params: {
  opts: OnboardOptions;
  baseConfig: CoreBlowConfig;
  detections: readonly SetupMigrationDetection[];
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  commitConfigFile: (config: CoreBlowConfig) => Promise<CoreBlowConfig>;
}): Promise<void> {
  return;
}

export type { MigrationProviderPlugin };
