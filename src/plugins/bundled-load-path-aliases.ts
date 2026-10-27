import path from "node:path";
import { isPathInside } from "./path-safety.js";

export type BundledPluginLoadPathAliasKind = "current" | "legacy";

export type BundledPluginLoadPathAlias = {
  kind: BundledPluginLoadPathAliasKind;
  path: string;
};

const PACKAGED_BUNDLED_ROOTS = [
  path.join("dist", "extensions"),
  path.join("dist-runtime", "extensions"),
] as const;

function normalizeBundledLookupPathInternal(targetPath: string): string {
  const normalized = path.normalize(targetPath);
  const root = path.parse(normalized).root;
  let trimmed = normalized;
  while (trimmed.length > root.length && (trimmed.endsWith(path.sep) || trimmed.endsWith("/"))) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function findPackagedBundledRoot(localPath: string): {
  packageRoot: string;
  bundledRoot: string;
} | null {
  const normalized = normalizeBundledLookupPathInternal(localPath);
  for (const packagedRoot of PACKAGED_BUNDLED_ROOTS) {
    const marker = `${path.sep}${packagedRoot}`;
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex === -1) {
      continue;
    }
    const markerEnd = markerIndex + marker.length;
    if (normalized.length !== markerEnd && normalized[markerEnd] !== path.sep) {
      continue;
    }
    return {
      packageRoot: normalized.slice(0, markerIndex),
      bundledRoot: normalized.slice(0, markerEnd),
    };
  }
  return null;
}

function isSameOrInside(baseDir: string, targetPath: string): boolean {
  const base = path.resolve(normalizeBundledLookupPathInternal(baseDir));
  const target = path.resolve(normalizeBundledLookupPathInternal(targetPath));
  return target === base || isPathInside(base, target);
}

/**
 * Service class for resolving bundled plugin load path aliases.
 */
export class BundledPluginLoadPathAliasResolver {
  public static normalizePath(targetPath: string): string {
    return normalizeBundledLookupPathInternal(targetPath);
  }

  public static buildLegacyPath(localPath: string): string | null {
    const packaged = findPackagedBundledRoot(localPath);
    if (!packaged) {
      return null;
    }
    const normalized = normalizeBundledLookupPathInternal(localPath);
    const bundledLeaf =
      normalized === packaged.bundledRoot
        ? ""
        : normalized.slice(packaged.bundledRoot.length + path.sep.length);
    return bundledLeaf ? path.join(packaged.packageRoot, "extensions", bundledLeaf) : null;
  }

  public static buildLegacyRootPath(localPath: string): string | null {
    const packaged = findPackagedBundledRoot(localPath);
    return packaged ? path.join(packaged.packageRoot, "extensions") : null;
  }

  public static buildAliases(localPath: string): BundledPluginLoadPathAlias[] {
    const legacyPath = BundledPluginLoadPathAliasResolver.buildLegacyPath(localPath);
    if (!legacyPath) {
      return [];
    }
    return [
      { kind: "current", path: localPath },
      { kind: "legacy", path: legacyPath },
    ];
  }

  public static resolvePackagedAlias(params: {
    bundledRoot?: string;
    loadPath: string;
  }): BundledPluginLoadPathAlias | null {
    if (!params.bundledRoot) {
      return null;
    }
    const packaged = findPackagedBundledRoot(params.bundledRoot);
    if (!packaged) {
      return null;
    }
    const legacyRoot = path.join(packaged.packageRoot, "extensions");
    if (isSameOrInside(params.bundledRoot, params.loadPath)) {
      return { kind: "current", path: params.loadPath };
    }
    if (isSameOrInside(legacyRoot, params.loadPath)) {
      return { kind: "legacy", path: params.loadPath };
    }
    return null;
  }
}

export const normalizeBundledLookupPath = BundledPluginLoadPathAliasResolver.normalizePath;
export const buildLegacyBundledPath = BundledPluginLoadPathAliasResolver.buildLegacyPath;
export const buildLegacyBundledRootPath = BundledPluginLoadPathAliasResolver.buildLegacyRootPath;
export const buildBundledPluginLoadPathAliases = BundledPluginLoadPathAliasResolver.buildAliases;
export const resolvePackagedBundledLoadPathAlias =
  BundledPluginLoadPathAliasResolver.resolvePackagedAlias;
