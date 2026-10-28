import { resolveIsNixMode } from "./paths.js";

export const NIX_COREBLOW_AGENT_FIRST_URL = "https://github.com/coreblow/nix-coreblow#quick-start";
export const COREBLOW_NIX_OVERVIEW_URL = "https://docs.coreblow.com/install/nix";
export const NIX_OPENCLAW_AGENT_FIRST_URL = NIX_COREBLOW_AGENT_FIRST_URL;
export const OPENCLAW_NIX_OVERVIEW_URL = COREBLOW_NIX_OVERVIEW_URL;

export class NixModeConfigMutationError extends Error {
  readonly code = "COREBLOW_NIX_MODE_CONFIG_IMMUTABLE";

  constructor(params: { configPath?: string } = {}) {
    super(formatNixModeConfigMutationMessage(params));
    this.name = "NixModeConfigMutationError";
  }
}

export function formatNixModeConfigMutationMessage(params: { configPath?: string } = {}): string {
  return [
    "Config is managed by Nix (`COREBLOW_NIX_MODE=1` or `OPENCLAW_NIX_MODE=1`), so CoreBlow treats coreblow.json as immutable.",
    "This usually means nix-coreblow, the first-party Nix distribution, or another Nix-managed package set this mode.",
    ...(params.configPath ? [`Config path: ${params.configPath}`] : []),
    "Do not run setup, onboarding, coreblow update, plugin install/update/uninstall/enable, doctor repair/token-generation, or config set against this file.",
    "Edit the Nix source for this install instead. For nix-coreblow, edit `programs.coreblow.config` or `instances.<name>.config`, then rebuild with Home Manager or NixOS.",
    `Agent-first Nix setup: ${NIX_COREBLOW_AGENT_FIRST_URL}`,
    `CoreBlow Nix overview: ${COREBLOW_NIX_OVERVIEW_URL}`,
  ].join("\n");
}

export function assertConfigWriteAllowedInCurrentMode(
  params: {
    configPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  if (!resolveIsNixMode(params.env)) {
    return;
  }
  throw new NixModeConfigMutationError({ configPath: params.configPath });
}
