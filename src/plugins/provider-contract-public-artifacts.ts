import type { ProviderPlugin } from "./types.js";
import { loadBundledPluginPublicSurface } from "../plugin-sdk/test-helpers/public-surface-loader.js";

type ProviderContractEntry = {
  pluginId: string;
  provider: ProviderPlugin;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProviderPlugin(value: unknown): value is ProviderPlugin {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.auth)
  );
}

async function tryLoadProviderContractApi(
  pluginId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await loadBundledPluginPublicSurface<Record<string, unknown>>({
      pluginId,
      artifactBasename: "provider-contract-api.ts",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Unknown bundled plugin id") ||
        error.message.includes("Cannot find module"))
    ) {
      return null;
    }
    throw error;
  }
}

function collectProviderContractEntries(params: {
  pluginId: string;
  mod: Record<string, unknown>;
}): ProviderContractEntry[] {
  const providers: ProviderContractEntry[] = [];
  for (const [name, exported] of Object.entries(params.mod).toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (
      typeof exported !== "function" ||
      exported.length !== 0 ||
      !name.startsWith("create") ||
      !name.endsWith("Provider")
    ) {
      continue;
    }
    const candidate = exported();
    if (isProviderPlugin(candidate)) {
      providers.push({ pluginId: params.pluginId, provider: candidate });
    }
  }
  return providers;
}

export async function resolveBundledExplicitProviderContractsFromPublicArtifacts(params: {
  onlyPluginIds: readonly string[];
}): Promise<ProviderContractEntry[] | null> {
  const providers: ProviderContractEntry[] = [];
  for (const pluginId of [...new Set(params.onlyPluginIds)].toSorted((left, right) =>
    left.localeCompare(right),
  )) {
    const mod = await tryLoadProviderContractApi(pluginId);
    if (!mod) {
      return null;
    }
    const entries = collectProviderContractEntries({ pluginId, mod });
    if (entries.length === 0) {
      return null;
    }
    providers.push(...entries);
  }
  return providers;
}
