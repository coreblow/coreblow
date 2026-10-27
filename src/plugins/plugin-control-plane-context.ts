import type { CoreBlowConfig } from "../config/config.js";
import { hashJson } from "./installed-plugin-index-hash.js";
import { resolveInstalledPluginIndexPolicyHash } from "./installed-plugin-index-policy.js";
import type { InstalledPluginIndex } from "./installed-plugin-index.js";
import { resolveInstalledManifestRegistryIndexFingerprint } from "./manifest-registry-installed.js";
import { resolvePluginCacheInputs, type PluginSourceRoots } from "./roots.js";

export type PluginDiscoveryContext = {
  roots: PluginSourceRoots;
  loadPaths: readonly string[];
};

export type PluginControlPlaneContext = {
  discovery: PluginDiscoveryContext;
  policyFingerprint: string;
  inventoryFingerprint?: string;
  activationFingerprint?: string;
};

export type ResolvePluginDiscoveryContextParams = {
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  loadPaths?: readonly string[];
};

export type ResolvePluginControlPlaneContextParams = ResolvePluginDiscoveryContextParams & {
  activationFingerprint?: string;
  index?: InstalledPluginIndex;
  inventoryFingerprint?: string;
  policyHash?: string;
};

function resolveConfiguredPluginLoadPaths(
  config: CoreBlowConfig | undefined,
): readonly string[] | undefined {
  const paths = config?.plugins?.load?.paths;
  return Array.isArray(paths) ? paths : undefined;
}

export class PluginControlPlaneContextResolver {
  public static resolveDiscovery(
    params: ResolvePluginDiscoveryContextParams = {},
  ): PluginDiscoveryContext {
    return resolvePluginCacheInputs({
      env: params.env ?? process.env,
      workspaceDir: params.workspaceDir,
      loadPaths: [...(params.loadPaths ?? resolveConfiguredPluginLoadPaths(params.config) ?? [])],
    });
  }

  public static resolveDiscoveryFingerprint(
    params: ResolvePluginDiscoveryContextParams = {},
  ): string {
    return this.fingerprintDiscovery(this.resolveDiscovery(params));
  }

  public static fingerprintDiscovery(context: PluginDiscoveryContext): string {
    return hashJson(context);
  }

  public static resolveContext(
    params: ResolvePluginControlPlaneContextParams = {},
  ): PluginControlPlaneContext {
    const inventoryFingerprint =
      params.inventoryFingerprint ??
      (params.index ? resolveInstalledManifestRegistryIndexFingerprint(params.index) : undefined);
    return {
      discovery: this.resolveDiscovery(params),
      policyFingerprint: params.policyHash ?? resolveInstalledPluginIndexPolicyHash(params.config),
      ...(inventoryFingerprint ? { inventoryFingerprint } : {}),
      ...(params.activationFingerprint
        ? { activationFingerprint: params.activationFingerprint }
        : {}),
    };
  }

  public static resolveFingerprint(
    params: ResolvePluginControlPlaneContextParams = {},
  ): string {
    return this.fingerprintContext(this.resolveContext(params));
  }

  public static fingerprintContext(context: PluginControlPlaneContext): string {
    return hashJson(context);
  }
}

export function resolvePluginDiscoveryContext(
  params: ResolvePluginDiscoveryContextParams = {},
): PluginDiscoveryContext {
  return PluginControlPlaneContextResolver.resolveDiscovery(params);
}

export function resolvePluginDiscoveryFingerprint(
  params: ResolvePluginDiscoveryContextParams = {},
): string {
  return PluginControlPlaneContextResolver.resolveDiscoveryFingerprint(params);
}

export function fingerprintPluginDiscoveryContext(context: PluginDiscoveryContext): string {
  return PluginControlPlaneContextResolver.fingerprintDiscovery(context);
}

export function resolvePluginControlPlaneContext(
  params: ResolvePluginControlPlaneContextParams = {},
): PluginControlPlaneContext {
  return PluginControlPlaneContextResolver.resolveContext(params);
}

export function resolvePluginControlPlaneFingerprint(
  params: ResolvePluginControlPlaneContextParams = {},
): string {
  return PluginControlPlaneContextResolver.resolveFingerprint(params);
}
