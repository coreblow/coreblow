import fs from "node:fs";
import path from "node:path";
import JSON5 from "json5";
import { resolveConfigPath } from "../config/paths.js";
import { getRuntimeConfigSnapshot, getRuntimeConfigSourceSnapshot } from "../config/runtime-snapshot.js";
import type { CoreBlowConfig } from "../config/types.js";
import { resolveBundledPluginsDir } from "../plugins/bundled-dir.js";
import { normalizePluginsConfig, resolveEffectiveEnableState } from "../plugins/config-state.js";
import { isPluginEnabledByDefaultForPlatform } from "../plugins/default-enablement.js";
import {
  loadPluginManifestRegistry,
  type PluginManifestRecord,
} from "../plugins/manifest-registry.js";
import { parseJsonWithJson5Fallback } from "../utils/parse-json-compat.js";
import { resolveRegistryPluginModuleLocationFromRecords } from "./facade-resolution-shared.js";

const ALWAYS_ALLOWED_RUNTIME_DIR_NAMES = new Set([
  "image-generation-core",
  "media-understanding-core",
  "speech-core",
]);
const EMPTY_FACADE_BOUNDARY_CONFIG: CoreBlowConfig = {};

export type FacadePluginManifestLike = {
  id: string;
  origin: PluginManifestRecord["origin"];
  enabledByDefault?: boolean;
  enabledByDefaultOnPlatforms?: readonly string[];
  rootDir: string;
  channels: readonly string[];
};

type FacadeModuleLocation = {
  modulePath: string;
  boundaryRoot: string;
};

function readFacadeBoundaryConfigSafely(): { rawConfig: CoreBlowConfig } {
  try {
    const sourceSnapshot = getRuntimeConfigSourceSnapshot();
    if (sourceSnapshot) {
      return { rawConfig: sourceSnapshot };
    }
    const runtimeSnapshot = getRuntimeConfigSnapshot();
    if (runtimeSnapshot) {
      return { rawConfig: runtimeSnapshot };
    }
    const configPath = resolveConfigPath();
    if (!fs.existsSync(configPath)) {
      return { rawConfig: EMPTY_FACADE_BOUNDARY_CONFIG };
    }
    const parsed = JSON5.parse(fs.readFileSync(configPath, "utf8"));
    return {
      rawConfig:
        parsed && typeof parsed === "object"
          ? (parsed as CoreBlowConfig)
          : EMPTY_FACADE_BOUNDARY_CONFIG,
    };
  } catch {
    return { rawConfig: EMPTY_FACADE_BOUNDARY_CONFIG };
  }
}

function getFacadeBoundaryResolvedConfig() {
  const { rawConfig } = readFacadeBoundaryConfigSafely();
  return {
    rawConfig,
    config: rawConfig,
    normalizedPluginsConfig: normalizePluginsConfig(rawConfig.plugins),
  };
}

function getFacadeManifestRegistry(params: {
  env?: NodeJS.ProcessEnv;
}): readonly PluginManifestRecord[] {
  return loadPluginManifestRegistry({
    config: getFacadeBoundaryResolvedConfig().config,
    ...(params.env ? { env: params.env } : {}),
  }).plugins;
}

export function resolveRegistryPluginModuleLocation(params: {
  dirName: string;
  artifactBasename: string;
  resolutionKey: string;
  env?: NodeJS.ProcessEnv;
}): FacadeModuleLocation | null {
  const registry = getFacadeManifestRegistry(params.env ? { env: params.env } : {});
  return resolveRegistryPluginModuleLocationFromRecords({
    registry,
    dirName: params.dirName,
    artifactBasename: params.artifactBasename,
  });
}

function readBundledPluginManifestRecordFromDir(params: {
  pluginsRoot: string;
  resolvedDirName: string;
}): FacadePluginManifestLike | null {
  const manifestPath = path.join(
    params.pluginsRoot,
    params.resolvedDirName,
    "coreblow.plugin.json",
  );
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = parseJsonWithJson5Fallback(fs.readFileSync(manifestPath, "utf8")) as {
      id?: unknown;
      enabledByDefault?: unknown;
      enabledByDefaultOnPlatforms?: unknown;
      channels?: unknown;
    };
    if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
      return null;
    }
    return {
      id: raw.id,
      origin: "bundled",
      enabledByDefault: raw.enabledByDefault === true,
      enabledByDefaultOnPlatforms: Array.isArray(raw.enabledByDefaultOnPlatforms)
        ? raw.enabledByDefaultOnPlatforms.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : undefined,
      rootDir: path.join(params.pluginsRoot, params.resolvedDirName),
      channels: Array.isArray(raw.channels)
        ? raw.channels.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function resolveBundledMetadataManifestRecord(params: {
  location: FacadeModuleLocation | null;
  sourceExtensionsRoot: string;
  env?: NodeJS.ProcessEnv;
}): FacadePluginManifestLike | null {
  if (!params.location) {
    return null;
  }
  if (params.location.modulePath.startsWith(`${params.sourceExtensionsRoot}${path.sep}`)) {
    const relativeToExtensions = path.relative(
      params.sourceExtensionsRoot,
      params.location.modulePath,
    );
    const resolvedDirName = relativeToExtensions.split(path.sep)[0];
    if (!resolvedDirName) {
      return null;
    }
    return readBundledPluginManifestRecordFromDir({
      pluginsRoot: params.sourceExtensionsRoot,
      resolvedDirName,
    });
  }

  const bundledPluginsDir = resolveBundledPluginsDir(params.env ?? process.env);
  if (!bundledPluginsDir) {
    return null;
  }
  const normalizedBundledPluginsDir = path.resolve(bundledPluginsDir);
  if (!params.location.modulePath.startsWith(`${normalizedBundledPluginsDir}${path.sep}`)) {
    return null;
  }
  const relativeToBundledDir = path.relative(
    normalizedBundledPluginsDir,
    params.location.modulePath,
  );
  const resolvedDirName = relativeToBundledDir.split(path.sep)[0];
  if (!resolvedDirName) {
    return null;
  }
  return readBundledPluginManifestRecordFromDir({
    pluginsRoot: normalizedBundledPluginsDir,
    resolvedDirName,
  });
}

function resolveBundledPluginManifestRecord(params: {
  dirName: string;
  location: FacadeModuleLocation | null;
  sourceExtensionsRoot: string;
  env?: NodeJS.ProcessEnv;
}): FacadePluginManifestLike | null {
  const metadataRecord = resolveBundledMetadataManifestRecord(params);
  if (metadataRecord) {
    return metadataRecord;
  }

  const registry = getFacadeManifestRegistry(params.env ? { env: params.env } : {});
  const resolved =
    (params.location
      ? registry.find((plugin) => {
          const normalizedRootDir = path.resolve(plugin.rootDir);
          const normalizedModulePath = path.resolve(params.location!.modulePath);
          return (
            normalizedModulePath === normalizedRootDir ||
            normalizedModulePath.startsWith(`${normalizedRootDir}${path.sep}`)
          );
        })
      : null) ??
    registry.find((plugin) => plugin.id === params.dirName) ??
    registry.find((plugin) => path.basename(plugin.rootDir) === params.dirName) ??
    registry.find((plugin) => plugin.channels.includes(params.dirName)) ??
    null;
  return resolved;
}

export function resolveTrackedFacadePluginId(params: {
  dirName: string;
  artifactBasename: string;
  location: FacadeModuleLocation | null;
  sourceExtensionsRoot: string;
  resolutionKey: string;
  env?: NodeJS.ProcessEnv;
}): string {
  return resolveBundledPluginManifestRecord(params)?.id ?? params.dirName;
}

export function resolveBundledPluginPublicSurfaceAccess(params: {
  dirName: string;
  artifactBasename: string;
  location: FacadeModuleLocation | null;
  sourceExtensionsRoot: string;
  resolutionKey: string;
  env?: NodeJS.ProcessEnv;
}): { allowed: boolean; pluginId?: string; reason?: string } {
  if (
    params.artifactBasename === "runtime-api.js" &&
    ALWAYS_ALLOWED_RUNTIME_DIR_NAMES.has(params.dirName)
  ) {
    return { allowed: true, pluginId: params.dirName };
  }

  const manifestRecord = resolveBundledPluginManifestRecord(params);
  if (!manifestRecord) {
    return {
      allowed: false,
      reason: `no bundled plugin manifest found for ${params.dirName}`,
    };
  }
  const { config, normalizedPluginsConfig } = getFacadeBoundaryResolvedConfig();
  return evaluateBundledPluginPublicSurfaceAccess({
    params,
    manifestRecord,
    config,
    normalizedPluginsConfig,
  });
}

export function evaluateBundledPluginPublicSurfaceAccess(params: {
  params: { dirName: string; artifactBasename: string };
  manifestRecord: FacadePluginManifestLike;
  config: CoreBlowConfig;
  normalizedPluginsConfig: ReturnType<typeof normalizePluginsConfig>;
}): { allowed: boolean; pluginId?: string; reason?: string } {
  const activationState = resolveEffectiveEnableState({
    id: params.manifestRecord.id,
    origin: params.manifestRecord.origin,
    config: params.normalizedPluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.manifestRecord),
  });
  if (activationState.enabled) {
    return { allowed: true, pluginId: params.manifestRecord.id };
  }

  return {
    allowed: false,
    pluginId: params.manifestRecord.id,
    reason: activationState.reason ?? "plugin runtime is not activated",
  };
}

export function throwForBundledPluginPublicSurfaceAccess(params: {
  access: { allowed: boolean; pluginId?: string; reason?: string };
  request: { dirName: string; artifactBasename: string };
}): never {
  const pluginLabel = params.access.pluginId ?? params.request.dirName;
  throw new Error(
    `Bundled plugin public surface access blocked for "${pluginLabel}" via ${params.request.dirName}/${params.request.artifactBasename}: ${params.access.reason ?? "plugin runtime is not activated"}`,
  );
}

export function resolveActivatedBundledPluginPublicSurfaceAccessOrThrow(params: {
  dirName: string;
  artifactBasename: string;
  location: FacadeModuleLocation | null;
  sourceExtensionsRoot: string;
  resolutionKey: string;
  env?: NodeJS.ProcessEnv;
}) {
  const access = resolveBundledPluginPublicSurfaceAccess(params);
  if (!access.allowed) {
    throwForBundledPluginPublicSurfaceAccess({
      access,
      request: params,
    });
  }
  return access;
}
