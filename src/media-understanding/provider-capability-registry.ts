import type { CoreBlowConfig } from "../config/config.js";
import { resolvePluginCapabilityProviders } from "../plugins/capability-provider-runtime.js";
import { resolveImageCapableConfigProviderIds } from "./config-provider-models.js";
import { normalizeMediaProviderId } from "./provider-id.js";
import type { MediaUnderstandingCapabilityRegistry } from "./types.js";

export function buildMediaUnderstandingCapabilityRegistry(
  cfg?: CoreBlowConfig,
): MediaUnderstandingCapabilityRegistry {
  const registry: MediaUnderstandingCapabilityRegistry = new Map();
  for (const provider of resolvePluginCapabilityProviders({
    key: "mediaUnderstandingProviders",
    cfg,
  })) {
    const id = normalizeMediaProviderId(provider.id);
    registry.set(id, { capabilities: provider.capabilities });
  }
  for (const id of resolveImageCapableConfigProviderIds(cfg)) {
    if (!registry.has(id)) {
      registry.set(id, { capabilities: ["image"] });
    }
  }
  return registry;
}
