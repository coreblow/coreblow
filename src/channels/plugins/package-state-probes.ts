import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { CoreBlowConfig } from "../../config/config.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import {
  listChannelPluginCatalogEntries,
  type ChannelPluginCatalogEntry,
} from "./catalog.js";

type ChannelPackageStateChecker = (params: {
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
}) => boolean;

type ChannelPackageStateMetadata = {
  specifier?: string;
  exportName?: string;
  env?: {
    allOf?: readonly string[];
    anyOf?: readonly string[];
  };
};

export type ChannelPackageStateMetadataKey = "configuredState" | "persistedAuthState";

export type ChannelPackageStateCatalogEntry = Pick<
  ChannelPluginCatalogEntry,
  "id" | "pluginId" | "rootDir" | "channel"
>;

const log = createSubsystemLogger("channels");
const requireFromHere = createRequire(import.meta.url);

type ChannelPackageStateModuleLocation = {
  modulePath: string;
  rootDir: string;
};

function isSourceModulePath(modulePath: string): boolean {
  return /\.(?:c|m)?tsx?$/iu.test(modulePath);
}

function resolveExistingPluginModulePath(rootDir: string, specifier: string): string {
  const resolvedBase = specifier.startsWith(".")
    ? path.resolve(rootDir, specifier)
    : requireFromHere.resolve(specifier);
  const candidates = [
    resolvedBase,
    `${resolvedBase}.js`,
    `${resolvedBase}.mjs`,
    `${resolvedBase}.cjs`,
    `${resolvedBase}.ts`,
    path.join(resolvedBase, "index.js"),
    path.join(resolvedBase, "index.mjs"),
    path.join(resolvedBase, "index.cjs"),
    path.join(resolvedBase, "index.ts"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? resolvedBase;
}

function loadChannelPackageStateModule(params: { modulePath: string }): unknown {
  if (isSourceModulePath(params.modulePath)) {
    throw new Error(`source package-state probe is not loadable without a runtime loader`);
  }
  return requireFromHere(params.modulePath) as unknown;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => normalizeOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function hasNonEmptyEnvValue(env: NodeJS.ProcessEnv | undefined, key: string): boolean {
  return typeof env?.[key] === "string" && env[key].trim().length > 0;
}

function resolveSourceBundledPluginRoot(rootDir: string): {
  packageRoot: string;
  dirName: string;
} | null {
  const pluginRoot = path.resolve(rootDir);
  const extensionsDir = path.dirname(pluginRoot);
  if (path.basename(extensionsDir) !== "extensions") {
    return null;
  }
  const packageRoot = path.dirname(extensionsDir);
  if (path.basename(packageRoot) === "dist" || path.basename(packageRoot) === "dist-runtime") {
    return null;
  }
  return {
    packageRoot,
    dirName: path.basename(pluginRoot),
  };
}

function listBuiltBundledPackageStateModules(params: {
  rootDir: string;
  specifier: string;
}): ChannelPackageStateModuleLocation[] {
  const sourceRoot = resolveSourceBundledPluginRoot(params.rootDir);
  if (!sourceRoot) {
    return [];
  }
  const locations: ChannelPackageStateModuleLocation[] = [];
  for (const rootDir of [
    path.join(sourceRoot.packageRoot, "dist", "extensions", sourceRoot.dirName),
    path.join(sourceRoot.packageRoot, "dist-runtime", "extensions", sourceRoot.dirName),
  ]) {
    const modulePath = resolveExistingPluginModulePath(rootDir, params.specifier);
    if (fs.existsSync(modulePath) && !isSourceModulePath(modulePath)) {
      locations.push({ modulePath, rootDir });
    }
  }
  return locations;
}

function resolveChannelPackageStateModuleLocation(params: {
  entry: ChannelPackageStateCatalogEntry;
  specifier: string;
}): ChannelPackageStateModuleLocation | null {
  if (!params.entry.rootDir) {
    return null;
  }
  return {
    modulePath: resolveExistingPluginModulePath(params.entry.rootDir, params.specifier),
    rootDir: params.entry.rootDir,
  };
}

function listChannelPackageStateModuleLocations(params: {
  entry: ChannelPackageStateCatalogEntry;
  specifier: string;
}): ChannelPackageStateModuleLocation[] {
  const source = resolveChannelPackageStateModuleLocation(params);
  if (!source) {
    return [];
  }
  const built = listBuiltBundledPackageStateModules({
    rootDir: source.rootDir,
    specifier: params.specifier,
  }).filter((location) => location.modulePath !== source.modulePath);
  return [...built, source];
}

function resolveChannelPackageStateMetadata(
  entry: ChannelPackageStateCatalogEntry,
  metadataKey: ChannelPackageStateMetadataKey,
): ChannelPackageStateMetadata | null {
  const metadata = entry.channel?.[metadataKey];
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const specifier = normalizeOptionalString(metadata.specifier) ?? "";
  const exportName = normalizeOptionalString(metadata.exportName) ?? "";
  const envMetadata = "env" in metadata ? metadata.env : undefined;
  const allOf = normalizeStringList(envMetadata?.allOf);
  const anyOf = normalizeStringList(envMetadata?.anyOf);
  const env = allOf.length > 0 || anyOf.length > 0 ? { allOf, anyOf } : undefined;
  if ((!specifier || !exportName) && !env) {
    return null;
  }
  return {
    ...(specifier ? { specifier } : {}),
    ...(exportName ? { exportName } : {}),
    ...(env ? { env } : {}),
  };
}

function listChannelPackageStateCatalog(params: {
  metadataKey: ChannelPackageStateMetadataKey;
  catalogEntries?: readonly ChannelPackageStateCatalogEntry[];
}): ChannelPackageStateCatalogEntry[] {
  const entries = params.catalogEntries ?? listChannelPluginCatalogEntries();
  return entries.filter((entry) => Boolean(resolveChannelPackageStateMetadata(entry, params.metadataKey)));
}

function resolveChannelPackageStateChecker(params: {
  entry: ChannelPackageStateCatalogEntry;
  metadataKey: ChannelPackageStateMetadataKey;
}): ChannelPackageStateChecker | null {
  const metadata = resolveChannelPackageStateMetadata(params.entry, params.metadataKey);
  if (!metadata) {
    return null;
  }

  if (metadata.env) {
    return ({ env }) => {
      const allOf = metadata.env?.allOf ?? [];
      const anyOf = metadata.env?.anyOf ?? [];
      return (
        allOf.every((key) => hasNonEmptyEnvValue(env, key)) &&
        (anyOf.length === 0 || anyOf.some((key) => hasNonEmptyEnvValue(env, key)))
      );
    };
  }

  let loadError: unknown;
  for (const location of listChannelPackageStateModuleLocations({
    entry: params.entry,
    specifier: metadata.specifier!,
  })) {
    try {
      const moduleExport = loadChannelPackageStateModule({
        modulePath: location.modulePath,
      }) as Record<string, unknown>;
      const checker = moduleExport[metadata.exportName!] as ChannelPackageStateChecker | undefined;
      if (typeof checker !== "function") {
        throw new Error(`missing ${params.metadataKey} export ${metadata.exportName}`);
      }
      return checker;
    } catch (error) {
      loadError = error;
    }
  }

  if (loadError) {
    const detail = formatErrorMessage(loadError);
    log.warn(
      `[channels] failed to load ${params.metadataKey} checker for ${params.entry.pluginId ?? params.entry.id}: ${detail}`,
    );
  }
  return null;
}

function resolvePackageStateChannelId(entry: ChannelPackageStateCatalogEntry): string | undefined {
  return normalizeOptionalString(entry.channel?.id ?? entry.id);
}

export function listBundledChannelIdsForPackageState(
  metadataKey: ChannelPackageStateMetadataKey,
  catalogEntries?: readonly ChannelPackageStateCatalogEntry[],
): string[] {
  return listChannelPackageStateCatalog({ metadataKey, catalogEntries })
    .map((entry) => resolvePackageStateChannelId(entry))
    .filter((channelId): channelId is string => Boolean(channelId));
}

export function hasBundledChannelPackageState(params: {
  metadataKey: ChannelPackageStateMetadataKey;
  channelId: string;
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  catalogEntries?: readonly ChannelPackageStateCatalogEntry[];
}): boolean {
  const requestedChannelId = normalizeOptionalString(params.channelId);
  const entry = listChannelPackageStateCatalog({
    metadataKey: params.metadataKey,
    catalogEntries: params.catalogEntries,
  }).find((candidate) => resolvePackageStateChannelId(candidate) === requestedChannelId);
  if (!entry) {
    return false;
  }
  const checker = resolveChannelPackageStateChecker({
    entry,
    metadataKey: params.metadataKey,
  });
  return checker ? checker({ cfg: params.cfg, env: params.env }) : false;
}
