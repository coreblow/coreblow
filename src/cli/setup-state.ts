import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "../config/config.js";
import { writeConfigFile } from "../config/config-io.js";
import { resolveAgentModelPrimaryValue } from "../config/model-input.js";
import { resolveStateDir } from "../config/paths.js";
import type { CoreBlowConfig } from "../config/types.js";
import {
  getGlobalCredentialPoolManager,
  type PooledCredential,
} from "../providers/credential-pool.js";

export interface ProviderSetupParams {
  provider: "anthropic" | "openai" | "gemini" | "openrouter" | "ollama" | "custom" | string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  theme?: "dark" | "light" | "auto";
  mode?: "basic" | "pro";
}

const PROVIDER_ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  ollama: "OLLAMA_HOST",
  custom: "COREBLOW_CUSTOM_BASE_URL",
};

/**
 * Checks if any LLM provider is configured in environment, config, or credential pool.
 */
export function isProviderConfigured(
  env: NodeJS.ProcessEnv = process.env,
  cfg: CoreBlowConfig = loadConfig(),
): boolean {
  // 1. Check environment variables
  for (const envKey of Object.values(PROVIDER_ENV_KEYS)) {
    const val = env[envKey]?.trim();
    if (val && val.length > 0) {
      return true;
    }
  }
  if (env.GOOGLE_API_KEY?.trim() || env.OLLAMA_BASE_URL?.trim() || env.OPENAI_BASE_URL?.trim()) {
    return true;
  }

  // 2. Check CoreBlow config
  const providers = cfg.models?.providers ?? {};
  for (const provider of Object.values(providers)) {
    const keyVal = typeof provider?.apiKey === "string" ? provider.apiKey.trim() : "";
    const baseVal = typeof provider?.baseUrl === "string" ? provider.baseUrl.trim() : "";
    if (keyVal || baseVal) {
      return true;
    }
    if (Array.isArray(provider?.models) && provider.models.length > 0) {
      return true;
    }
  }

  // Check if primary agent model is set to a non-empty, non-native string
  const primaryModel = resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model);
  if (primaryModel && !primaryModel.includes("coreblow/native") && !primaryModel.includes("native")) {
    return true;
  }

  // 3. Check Credential Pool
  try {
    const pool = getGlobalCredentialPoolManager();
    const maskedPools = pool.getMaskedPools().pools;
    for (const keys of Object.values(maskedPools)) {
      if (keys.some((c) => c.enabled && Boolean(c.apiKey))) {
        return true;
      }
    }
  } catch {
    // Ignore pool read errors
  }

  return false;
}

/**
 * Persists provider credentials to ~/.coreblow/.env with 0600 permissions
 * and updates CoreBlow configuration.
 */
export async function saveProviderSetup(params: ProviderSetupParams): Promise<void> {
  const stateDir = resolveStateDir();
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const envPath = path.join(stateDir, ".env");
  const envKey = PROVIDER_ENV_KEYS[params.provider] ?? `${params.provider.toUpperCase()}_API_KEY`;

  // 1. Update ~/.coreblow/.env
  let existingEnv = "";
  if (fs.existsSync(envPath)) {
    try {
      existingEnv = fs.readFileSync(envPath, "utf8");
    } catch {
      existingEnv = "";
    }
  }

  const lines = existingEnv.split("\n").filter((l) => {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const key = trimmed.split("=")[0]?.trim();
    if (key === envKey) return false;
    if (params.baseUrl && key === "COREBLOW_CUSTOM_BASE_URL") return false;
    if (params.theme && key === "COREBLOW_THEME") return false;
    return true;
  });

  if (params.apiKey?.trim()) {
    lines.push(`${envKey}=${params.apiKey.trim()}`);
    process.env[envKey] = params.apiKey.trim();
  }
  if (params.baseUrl?.trim()) {
    lines.push(`COREBLOW_CUSTOM_BASE_URL=${params.baseUrl.trim()}`);
    process.env.COREBLOW_CUSTOM_BASE_URL = params.baseUrl.trim();
  }
  if (params.theme) {
    lines.push(`COREBLOW_THEME=${params.theme}`);
    process.env.COREBLOW_THEME = params.theme;
  }

  const newEnvContent = lines.filter(Boolean).join("\n") + "\n";
  fs.writeFileSync(envPath, newEnvContent, { mode: 0o600 });

  // 2. Update CoreBlow Config
  const cfg = loadConfig();
  const nextCfg: Record<string, any> = { ...cfg };

  if (!nextCfg.models) nextCfg.models = {};
  if (!nextCfg.models.providers) nextCfg.models.providers = {};
  if (!nextCfg.agents) nextCfg.agents = {};
  if (!nextCfg.agents.defaults) nextCfg.agents.defaults = {};

  const currentProviderConfig = { ...nextCfg.models.providers[params.provider] };
  if (params.apiKey?.trim()) {
    currentProviderConfig.apiKey = params.apiKey.trim();
  }
  if (params.baseUrl?.trim()) {
    currentProviderConfig.baseUrl = params.baseUrl.trim();
  }
  nextCfg.models.providers[params.provider] = currentProviderConfig;

  if (params.model?.trim()) {
    nextCfg.agents.defaults.model = {
      primary: params.model.trim(),
    };
  }

  await writeConfigFile(nextCfg as CoreBlowConfig);

  // 3. Register in CredentialPoolManager
  if (params.apiKey?.trim()) {
    try {
      const pool = getGlobalCredentialPoolManager();
      pool.addCredential({
        providerId: params.provider as any,
        label: `${params.provider} Key`,
        apiKey: params.apiKey.trim(),
        priority: 1,
      });
    } catch {
      // Best-effort
    }
  }
}
