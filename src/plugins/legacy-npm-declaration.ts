import path from "node:path";
import { tryReadJsonSync } from "../infra/json-files.js";
import { parseRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import { validatePluginId } from "./install-paths.js";

export const LEGACY_NPM_DECLARATION_FILE = "coreblow.extension.json";
export const LEGACY_NPM_DECLARATION_FALLBACK_FILE = "openclaw.extension.json";

export type LegacyNpmPluginDeclaration = {
  pluginId: string;
  npmSpec: string;
  source: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Service class for reading legacy plugin declaration files.
 */
export class LegacyNpmPluginDeclarationReader {
  public static read(pluginDir: string): LegacyNpmPluginDeclaration | null {
    // Check primary coreblow declaration first, then fallback to legacy openclaw declaration
    let source = path.join(pluginDir, LEGACY_NPM_DECLARATION_FILE);
    let parsed = tryReadJsonSync(source);
    if (!isRecord(parsed)) {
      source = path.join(pluginDir, LEGACY_NPM_DECLARATION_FALLBACK_FILE);
      parsed = tryReadJsonSync(source);
    }
    if (!isRecord(parsed) || parsed.type !== "npm") {
      return null;
    }
    const pluginId = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const npmSpec = typeof parsed.npmSpec === "string" ? parsed.npmSpec.trim() : "";
    if (!pluginId || validatePluginId(pluginId) || !parseRegistryNpmSpec(npmSpec)) {
      return null;
    }
    return { pluginId, npmSpec, source };
  }
}

export function readLegacyNpmPluginDeclaration(pluginDir: string): LegacyNpmPluginDeclaration | null {
  return LegacyNpmPluginDeclarationReader.read(pluginDir);
}
