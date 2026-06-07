import { formatCliCommand } from "../cli/command-format.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { MigrationProviderPlugin } from "../plugin-sdk/plugin-entry.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";

export type PostInstallMigrationOptions = {
  config: CoreBlowConfig;
  runtime: RuntimeEnv;
  prompter?: WizardPrompter;
  installedPluginIds: readonly string[];
  nonInteractive?: boolean;
};

export type PostInstallMigrationResult = {
  config: CoreBlowConfig;
};

type ResolvedProviderCandidate = {
  provider: MigrationProviderPlugin;
  source?: string;
};

function describeCandidate(candidate: ResolvedProviderCandidate): string {
  const parts = [candidate.provider.label];
  if (candidate.source) {
    parts.push(`at ${candidate.source}`);
  }
  return parts.join(" ");
}

function logMigrationHint(runtime: RuntimeEnv, candidate: ResolvedProviderCandidate): void {
  const command = formatCliCommand(`coreblow migrate ${candidate.provider.id} --dry-run`);
  runtime.log(`Detected ${describeCandidate(candidate)}. Preview migration with ${command}.`);
}

export async function offerPostInstallMigrations(
  params: PostInstallMigrationOptions,
): Promise<PostInstallMigrationResult> {
  if (params.installedPluginIds.length === 0) {
    return { config: params.config };
  }

  // CoreBlow migration providers are extension-owned. The registry runtime is optional during
  // wizard setup, so this facade is intentionally conservative until providers are loaded.
  const candidates: ResolvedProviderCandidate[] = [];
  for (const candidate of candidates) {
    logMigrationHint(params.runtime, candidate);
  }
  return { config: params.config };
}
