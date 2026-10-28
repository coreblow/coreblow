import type { CoreBlowConfig } from "../config/config.js";
import { coerceSecretRef, type SecretRef } from "../config/types.secrets.js";
import { resolveDefaultSecretProviderAlias } from "../secrets/ref-contract.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
import type {
  PluginManifestCapabilityProviderAuthSignal,
  PluginManifestCapabilityProviderConfigSignal,
} from "./manifest.js";

type ToolMetadata = NonNullable<PluginManifestRecord["toolMetadata"]>[string];
export type ManifestConfigAvailabilitySignal = PluginManifestCapabilityProviderConfigSignal;
export type ManifestAuthAvailabilitySignal = PluginManifestCapabilityProviderAuthSignal;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readPath(root: unknown, path: string | undefined): unknown {
  if (!path?.trim()) {
    return root;
  }
  let current = root;
  for (const segment of path.split(".")) {
    const key = segment.trim();
    if (!key) {
      return undefined;
    }
    if (!isRecord(current) || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function readStringAtPath(root: unknown, path: string): string | undefined {
  const value = readPath(root, path);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readEffectiveConfig(params: {
  config?: CoreBlowConfig;
  rootPath: string;
  overlayPath?: string;
}): Record<string, unknown> | undefined {
  const root = readPath(params.config, params.rootPath);
  if (!isRecord(root)) {
    return undefined;
  }
  const overlay = readPath(root, params.overlayPath);
  return isRecord(overlay) ? { ...root, ...overlay } : root;
}

function hasConfiguredSecretRefInConfigPath(params: {
  config?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  ref: SecretRef;
}): boolean {
  const providerConfig = params.config?.secrets?.providers?.[params.ref.provider];
  if (params.ref.source !== "env") {
    return Boolean(providerConfig && providerConfig.source === params.ref.source);
  }
  if (!providerConfig) {
    return params.ref.provider === resolveDefaultSecretProviderAlias(params.config ?? {}, "env");
  }
  if (providerConfig.source !== "env") {
    return false;
  }
  const allowlist = providerConfig.allowlist;
  return !allowlist || allowlist.includes(params.ref.id);
}

function hasConfiguredValue(params: {
  config?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  value: unknown;
}): boolean {
  const secretRef = coerceSecretRef(params.value, params.config?.secrets?.defaults);
  if (secretRef) {
    return (
      hasConfiguredSecretRefInConfigPath({
        config: params.config,
        env: params.env,
        ref: secretRef,
      }) &&
      (secretRef.source !== "env" || Boolean(params.env[secretRef.id]?.trim()))
    );
  }
  if (typeof params.value === "string") {
    return params.value.trim().length > 0;
  }
  if (Array.isArray(params.value)) {
    return params.value.length > 0;
  }
  if (isRecord(params.value)) {
    return Object.keys(params.value).length > 0;
  }
  return params.value !== undefined && params.value !== null;
}

function normalizeBaseUrlForManifestGuard(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function listToolAuthSignals(metadata: ToolMetadata): ManifestAuthAvailabilitySignal[] {
  if (metadata.authSignals?.length) {
    return metadata.authSignals;
  }
  return [...(metadata.authProviders ?? []), ...(metadata.aliases ?? [])].map((provider) => ({
    provider,
  }));
}

/**
 * Service checking availability signals for manifest-declared tools.
 */
export class ManifestToolAvailabilityChecker {
  public static manifestConfigSignalPasses(params: {
    config?: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    signal: ManifestConfigAvailabilitySignal;
  }): boolean {
    const effectiveConfig = readEffectiveConfig({
      config: params.config,
      rootPath: params.signal.rootPath,
      overlayPath: params.signal.overlayPath,
    });
    if (!effectiveConfig) {
      return false;
    }
    const modeSignal = params.signal.mode;
    if (modeSignal) {
      const modePath = modeSignal.path?.trim() || "mode";
      const mode = readStringAtPath(effectiveConfig, modePath) ?? modeSignal.default;
      if (!mode) {
        return false;
      }
      if (modeSignal.allowed?.length && !modeSignal.allowed.includes(mode)) {
        return false;
      }
      if (modeSignal.disallowed?.includes(mode)) {
        return false;
      }
    }
    for (const requiredPath of params.signal.required ?? []) {
      if (
        !hasConfiguredValue({
          config: params.config,
          env: params.env,
          value: readPath(effectiveConfig, requiredPath),
        })
      ) {
        return false;
      }
    }
    const requiredAny = params.signal.requiredAny ?? [];
    if (
      requiredAny.length > 0 &&
      !requiredAny.some((path: string) =>
        hasConfiguredValue({
          config: params.config,
          env: params.env,
          value: readPath(effectiveConfig, path),
        }),
      )
    ) {
      return false;
    }
    return true;
  }

  public static manifestProviderBaseUrlGuardPasses(params: {
    config?: CoreBlowConfig;
    guard: ManifestAuthAvailabilitySignal["providerBaseUrl"];
  }): boolean {
    const guard = params.guard;
    if (!guard) {
      return true;
    }
    const providerConfig = params.config?.models?.providers?.[guard.provider];
    const rawBaseUrl =
      typeof providerConfig?.baseUrl === "string" && providerConfig.baseUrl.trim()
        ? providerConfig.baseUrl
        : guard.defaultBaseUrl;
    if (!rawBaseUrl) {
      return false;
    }
    const normalizedBaseUrl = normalizeBaseUrlForManifestGuard(rawBaseUrl);
    return guard.allowedBaseUrls.some(
      (allowedBaseUrl: string) => normalizeBaseUrlForManifestGuard(allowedBaseUrl) === normalizedBaseUrl,
    );
  }

  public static manifestPluginSetupProviderEnvVars(
    plugin: PluginManifestRecord,
    providerId: string,
  ): readonly string[] {
    const direct = plugin.setup?.providers?.find((provider) => provider.id === providerId)?.envVars;
    if (direct && direct.length > 0) {
      return direct;
    }
    return plugin.providerAuthEnvVars?.[providerId] ?? [];
  }

  public static hasNonEmptyManifestEnvCandidate(
    env: NodeJS.ProcessEnv,
    envVars: readonly string[],
  ): boolean {
    return envVars.some((envVar) => {
      const key = envVar.trim();
      return key.length > 0 && Boolean(env[key]?.trim());
    });
  }

  public static hasManifestToolAvailability(params: {
    plugin: PluginManifestRecord;
    toolNames: readonly string[];
    config?: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    hasAuthForProvider?: (providerId: string) => boolean;
  }): boolean {
    for (const toolName of params.toolNames) {
      const metadata = params.plugin.toolMetadata?.[toolName];
      if (!metadata) {
        return true;
      }
      if (
        this.toolMetadataPasses({
          plugin: params.plugin,
          metadata,
          config: params.config,
          env: params.env,
          hasAuthForProvider: params.hasAuthForProvider,
        })
      ) {
        return true;
      }
    }
    return false;
  }

  private static toolMetadataPasses(params: {
    plugin: PluginManifestRecord;
    metadata: ToolMetadata;
    config?: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    hasAuthForProvider?: (providerId: string) => boolean;
  }): boolean {
    const authSignals = listToolAuthSignals(params.metadata);
    if (!params.metadata.configSignals?.length && authSignals.length === 0) {
      return true;
    }
    if (
      params.metadata.configSignals?.some((signal: ManifestConfigAvailabilitySignal) =>
        this.manifestConfigSignalPasses({
          config: params.config,
          env: params.env,
          signal,
        }),
      )
    ) {
      return true;
    }
    for (const signal of authSignals) {
      if (
        !this.manifestProviderBaseUrlGuardPasses({
          config: params.config,
          guard: signal.providerBaseUrl,
        })
      ) {
        continue;
      }
      if (params.hasAuthForProvider?.(signal.provider)) {
        return true;
      }
      if (
        this.hasNonEmptyManifestEnvCandidate(
          params.env,
          this.manifestPluginSetupProviderEnvVars(params.plugin, signal.provider),
        )
      ) {
        return true;
      }
    }
    return false;
  }
}

export function manifestConfigSignalPasses(params: {
  config?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  signal: ManifestConfigAvailabilitySignal;
}): boolean {
  return ManifestToolAvailabilityChecker.manifestConfigSignalPasses(params);
}

export function manifestProviderBaseUrlGuardPasses(params: {
  config?: CoreBlowConfig;
  guard: ManifestAuthAvailabilitySignal["providerBaseUrl"];
}): boolean {
  return ManifestToolAvailabilityChecker.manifestProviderBaseUrlGuardPasses(params);
}

export function manifestPluginSetupProviderEnvVars(
  plugin: PluginManifestRecord,
  providerId: string,
): readonly string[] {
  return ManifestToolAvailabilityChecker.manifestPluginSetupProviderEnvVars(plugin, providerId);
}

export function hasNonEmptyManifestEnvCandidate(
  env: NodeJS.ProcessEnv,
  envVars: readonly string[],
): boolean {
  return ManifestToolAvailabilityChecker.hasNonEmptyManifestEnvCandidate(env, envVars);
}

export function hasManifestToolAvailability(params: {
  plugin: PluginManifestRecord;
  toolNames: readonly string[];
  config?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  hasAuthForProvider?: (providerId: string) => boolean;
}): boolean {
  return ManifestToolAvailabilityChecker.hasManifestToolAvailability(params);
}
