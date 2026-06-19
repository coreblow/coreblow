import type { CoreBlowConfig } from "../config/config.js";
import { buildMediaUnderstandingRegistry } from "./provider-registry.js";
import type { MediaUnderstandingProvider } from "./types.js";

export function buildMediaUnderstandingManifestMetadataRegistry(
  cfg?: CoreBlowConfig,
  _workspaceDir?: string,
): Map<string, MediaUnderstandingProvider> {
  return buildMediaUnderstandingRegistry(undefined, cfg);
}
