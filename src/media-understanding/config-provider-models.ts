import type { CoreBlowConfig } from "../config/config.js";
import { normalizeMediaProviderId } from "./provider-id.js";

export function resolveImageCapableConfigProviderIds(cfg?: CoreBlowConfig): string[] {
  const providers = cfg?.models?.providers;
  if (!providers || typeof providers !== "object") {
    return [];
  }
  return Object.entries(providers)
    .filter(([, provider]) =>
      provider.models?.some((model) => Array.isArray(model.input) && model.input.includes("image")),
    )
    .map(([providerId]) => normalizeMediaProviderId(providerId))
    .filter(Boolean);
}
