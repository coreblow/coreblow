import type { MediaUnderstandingModelConfig } from "../config/types.tools.js";
import { normalizeMediaProviderId } from "./provider-id.js";
import type {
  MediaUnderstandingCapability,
  MediaUnderstandingCapabilityRegistry,
} from "./types.js";

const CAPABILITIES = new Set<MediaUnderstandingCapability>(["audio", "image", "video"]);

export function resolveConfiguredMediaEntryCapabilities(
  entry: MediaUnderstandingModelConfig,
): MediaUnderstandingCapability[] | undefined {
  const capabilities = Array.isArray(entry.capabilities)
    ? entry.capabilities.filter((item): item is MediaUnderstandingCapability =>
        CAPABILITIES.has(item as MediaUnderstandingCapability),
      )
    : [];
  return capabilities.length > 0 ? capabilities : undefined;
}

export function resolveEffectiveMediaEntryCapabilities(params: {
  entry: MediaUnderstandingModelConfig;
  source: "shared" | "capability";
  providerRegistry: MediaUnderstandingCapabilityRegistry;
}): MediaUnderstandingCapability[] | undefined {
  const configured = resolveConfiguredMediaEntryCapabilities(params.entry);
  if (configured || params.source !== "shared" || params.entry.type === "cli" || params.entry.command) {
    return configured;
  }
  const providerId = normalizeMediaProviderId(params.entry.provider ?? "");
  return providerId ? params.providerRegistry.get(providerId)?.capabilities : undefined;
}

export function matchesMediaEntryCapability(params: {
  entry: MediaUnderstandingModelConfig;
  source: "shared" | "capability";
  capability: MediaUnderstandingCapability;
  providerRegistry: MediaUnderstandingCapabilityRegistry;
}): boolean {
  const capabilities = resolveEffectiveMediaEntryCapabilities(params);
  return capabilities?.includes(params.capability) ?? params.source === "capability";
}
