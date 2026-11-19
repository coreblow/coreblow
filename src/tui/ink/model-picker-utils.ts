import type { CoreBlowConfig } from "../../config/types.js";

export type ReasoningEffort = "off" | "low" | "medium" | "high";

const EFFORT_LEVELS: readonly ReasoningEffort[] = ["off", "low", "medium", "high"];

/**
 * Normalizes provider and model id to prevent duplicate prefixes like coreblow/coreblow/native.
 */
export function normalizeModelId(provider: string, modelId: string): string {
  const p = (provider || "").trim().toLowerCase();
  let m = (modelId || "").trim();
  if (!m) {
    return p ? `${p}/native` : "coreblow/native";
  }

  // If m contains a slash with duplicate token (e.g. coreblow/coreblow/native)
  while (true) {
    const parts = m.split("/");
    if (parts.length >= 2 && parts[0]?.toLowerCase() === parts[1]?.toLowerCase()) {
      m = `${parts[0]}/${parts.slice(2).join("/")}`;
    } else {
      break;
    }
  }

  // If already starts with provider + "/", return as is
  if (p && m.toLowerCase().startsWith(`${p}/`)) {
    return m;
  }

  if (p && !m.includes("/")) {
    return `${p}/${m}`;
  }

  return m;
}

/**
 * Splits a full model reference into { provider, model }.
 */
export function splitModelRef(ref: string): { provider: string; model: string } {
  const trimmed = (ref || "").trim();
  if (!trimmed) {
    return { provider: "coreblow", model: "native" };
  }
  const parts = trimmed.split("/");
  if (parts.length >= 2) {
    return {
      provider: parts[0]!.toLowerCase(),
      model: parts.slice(1).join("/"),
    };
  }
  return { provider: "coreblow", model: trimmed };
}

/**
 * Clears stale baseUrl or active overrides when switching to a different provider.
 */
export function cleanupStaleProviderConfig(
  prevProvider: string,
  nextProvider: string,
  cfg: CoreBlowConfig,
): CoreBlowConfig {
  if (!prevProvider || !nextProvider || prevProvider === nextProvider) {
    return cfg;
  }

  const updated: Record<string, any> = { ...cfg };
  if (updated.models?.providers?.[prevProvider]) {
    // If switching away from a custom endpoint, remove stale custom baseUrl
    const prevCfg = { ...updated.models.providers[prevProvider] };
    if (prevProvider === "custom") {
      delete prevCfg.baseUrl;
      updated.models.providers[prevProvider] = prevCfg;
    }
  }

  return updated as CoreBlowConfig;
}

/**
 * Cycles reasoning effort with Left/Right arrow keys.
 */
export function cycleReasoningEffort(
  current: string = "off",
  direction: "left" | "right",
): ReasoningEffort {
  const normalized = (current || "off").toLowerCase() as ReasoningEffort;
  const index = EFFORT_LEVELS.indexOf(normalized);
  const curIdx = index >= 0 ? index : 0;

  if (direction === "right") {
    return EFFORT_LEVELS[(curIdx + 1) % EFFORT_LEVELS.length]!;
  }
  return EFFORT_LEVELS[(curIdx - 1 + EFFORT_LEVELS.length) % EFFORT_LEVELS.length]!;
}
