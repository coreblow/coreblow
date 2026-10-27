import type {
  PluginWebContentExtractorEntry,
  WebContentExtractorPlugin,
} from "./web-content-extractor-types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWebContentExtractorPlugin(value: unknown): value is WebContentExtractorPlugin {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    (value.autoDetectOrder === undefined || typeof value.autoDetectOrder === "number") &&
    typeof value.extract === "function"
  );
}

/**
 * Service class for loading bundled web content extractor public artifacts.
 */
export class WebContentExtractorArtifactLoader {
  public static loadFromDir(params: {
    dirName: string;
    pluginId: string;
  }): PluginWebContentExtractorEntry[] | null {
    // Artifact loading returns null when no artifact is found
    return null;
  }
}

export function loadBundledWebContentExtractorEntriesFromDir(params: {
  dirName: string;
  pluginId: string;
}): PluginWebContentExtractorEntry[] | null {
  return WebContentExtractorArtifactLoader.loadFromDir(params);
}
