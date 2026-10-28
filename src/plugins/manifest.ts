import fs from "node:fs";
import path from "node:path";
import type { ChannelConfigRuntimeSchema } from "../channels/plugins/types.plugin.js";
import { MANIFEST_KEY } from "../compat/legacy-names.js";
import { matchBoundaryFileOpenFailure, openBoundaryFileSync } from "../infra/boundary-file-read.js";
import type { ModelCatalog } from "../model-catalog/index.js";
import { isRecord } from "../utils.js";
import type { PluginConfigUiHint, PluginKind } from "./types.js";

export const PLUGIN_MANIFEST_FILENAME = "coreblow.plugin.json";
export const PLUGIN_MANIFEST_FILENAMES = [
  PLUGIN_MANIFEST_FILENAME,
  "openclaw.plugin.json",
] as const;

export type PluginManifestModelCatalog = ModelCatalog;

export type PluginManifestDangerousConfigFlag = {
  path: string;
  expected?: "string";
};

export type PluginManifestModelIdPrefixRule = {
  modelPrefix: string;
  prefix: string;
};

export type PluginManifestModelIdNormalizationProvider = {
  aliases?: Record<string, string>;
  stripPrefixes?: string[];
  prefixWhenBare?: string;
  prefixWhenBareAfterAliasStartsWith?: PluginManifestModelIdPrefixRule[];
};

export type PluginManifestModelIdNormalization = {
  providers?: Record<string, PluginManifestModelIdNormalizationProvider>;
};

export type PluginManifestProviderBaseUrlGuard = {
  provider: string;
  defaultBaseUrl?: string;
  allowedBaseUrls: string[];
};

export type PluginManifestCapabilityProviderAuthSignal = {
  provider: string;
  providerBaseUrl?: PluginManifestProviderBaseUrlGuard;
};

export type PluginManifestCapabilityProviderModeConfigSignal = {
  path?: string;
  default?: string;
  allowed?: string[];
  disallowed?: string[];
};

export type PluginManifestCapabilityProviderConfigSignal = {
  rootPath: string;
  overlayPath?: string;
  required?: string[];
  requiredAny?: string[];
  mode?: PluginManifestCapabilityProviderModeConfigSignal;
};

export type PluginManifestCapabilityProviderMetadata = {
  aliases?: string[];
  authProviders?: string[];
  authSignals?: PluginManifestCapabilityProviderAuthSignal[];
  configSignals?: PluginManifestCapabilityProviderConfigSignal[];
  referenceAudioInputs?: boolean;
};

export type PluginManifestToolMetadata = PluginManifestCapabilityProviderMetadata & {
  optional?: boolean;
};

export type PluginManifestSecretInputContracts = {
  bundledDefaultEnabled?: boolean;
  paths?: string[];
};

export type PluginManifestConfigContracts = {
  compatibilityMigrationPaths?: string[];
  compatibilityRuntimePaths?: string[];
  dangerousFlags?: PluginManifestDangerousConfigFlag[];
  secretInputs?: PluginManifestSecretInputContracts;
};

export type PluginManifestChannelCommandDefaults = {
  nativeCommandsAutoEnabled?: boolean;
  nativeSkillsAutoEnabled?: boolean;
};

export type PluginManifestChannelConfig = {
  schema: Record<string, unknown>;
  uiHints?: Record<string, PluginConfigUiHint>;
  runtime?: ChannelConfigRuntimeSchema;
  label?: string;
  description?: string;
  preferOver?: string[];
  commands?: PluginManifestChannelCommandDefaults;
};

export type PluginManifestActivationCapability = "provider" | "channel" | "tool" | "hook";

export type PluginManifestActivation = {
  onStartup?: boolean;
  onProviders?: string[];
  onAgentHarnesses?: string[];
  onCommands?: string[];
  onChannels?: string[];
  onRoutes?: string[];
  onConfigPaths?: string[];
  onCapabilities?: PluginManifestActivationCapability[];
};

export type PluginManifestSetupProvider = {
  id: string;
  authMethods?: string[];
  envVars?: string[];
};

export type PluginManifestSetup = {
  providers?: PluginManifestSetupProvider[];
  cliBackends?: string[];
  configMigrations?: string[];
  requiresRuntime?: boolean;
};

export type PluginManifest = {
  id: string;
  configSchema: Record<string, unknown>;
  enabledByDefault?: boolean;
  enabledByDefaultOnPlatforms?: string[];
  modelIdNormalization?: PluginManifestModelIdNormalization;
  toolMetadata?: Record<string, PluginManifestToolMetadata>;
  /** Legacy plugin ids that should normalize to this plugin id. */
  legacyPluginIds?: string[];
  /** Provider ids that should auto-enable this plugin when referenced in auth/config/models. */
  autoEnableWhenConfiguredProviders?: string[];
  kind?: PluginKind;
  channels?: string[];
  providers?: string[];
  /** Cheap startup activation lookup for plugin-owned CLI inference backends. */
  cliBackends?: string[];
  /** Cheap provider-auth env lookup without booting plugin runtime. */
  providerAuthEnvVars?: Record<string, string[]>;
  /**
   * Cheap onboarding/auth-choice metadata used by config validation, CLI help,
   * and non-runtime auth-choice routing before provider runtime loads.
   */
  providerAuthChoices?: PluginManifestProviderAuthChoice[];
  skills?: string[];
  name?: string;
  description?: string;
  version?: string;
  uiHints?: Record<string, PluginConfigUiHint>;
  /**
   * Static capability ownership snapshot used for manifest-driven discovery,
   * compat wiring, and contract coverage without importing plugin runtime.
   */
  contracts?: PluginManifestContracts;
  configContracts?: PluginManifestConfigContracts;
  modelCatalog?: PluginManifestModelCatalog;
  channelConfigs?: Record<string, PluginManifestChannelConfig>;
};

export type PluginManifestContracts = {
  externalAuthProviders?: string[];
  memoryEmbeddingProviders?: string[];
  embeddedExtensionFactories?: string[];
  gatewayMethodDispatch?: string[];
  speechProviders?: string[];
  realtimeTranscriptionProviders?: string[];
  realtimeVoiceProviders?: string[];
  mediaUnderstandingProviders?: string[];
  documentExtractors?: string[];
  imageGenerationProviders?: string[];
  videoGenerationProviders?: string[];
  musicGenerationProviders?: string[];
  webContentExtractors?: string[];
  webFetchProviders?: string[];
  webSearchProviders?: string[];
  migrationProviders?: string[];
  agentToolResultMiddleware?: string[];
  tools?: string[];
};

export type PluginManifestContractListKey = keyof PluginManifestContracts;

export type PluginManifestProviderAuthChoice = {
  /** Provider id owned by this manifest entry. */
  provider: string;
  /** Provider auth method id that this choice should dispatch to. */
  method: string;
  /** Stable auth-choice id used by onboarding and other CLI auth flows. */
  choiceId: string;
  /** Optional user-facing choice label/hint for grouped onboarding UI. */
  choiceLabel?: string;
  choiceHint?: string;
  /** Legacy choice ids that should point users at this replacement choice. */
  deprecatedChoiceIds?: string[];
  /** Optional grouping metadata for auth-choice pickers. */
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  /** Optional CLI flag metadata for one-flag auth flows such as API keys. */
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  /**
   * Interactive onboarding surfaces where this auth choice should appear.
   * Defaults to `["text-inference"]` when omitted.
   */
  onboardingScopes?: PluginManifestOnboardingScope[];
};

export type PluginManifestOnboardingScope = "text-inference" | "image-generation";

export type PluginManifestLoadResult =
  | { ok: true; manifest: PluginManifest; manifestPath: string }
  | { ok: false; error: string; manifestPath: string };

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

function normalizeStringListRecord(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, string[]> = {};
  for (const [key, rawValues] of Object.entries(value)) {
    const providerId = typeof key === "string" ? key.trim() : "";
    if (!providerId) {
      continue;
    }
    const values = normalizeStringList(rawValues);
    if (values.length === 0) {
      continue;
    }
    normalized[providerId] = values;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeManifestContracts(value: unknown): PluginManifestContracts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const speechProviders = normalizeStringList(value.speechProviders);
  const realtimeTranscriptionProviders = normalizeStringList(value.realtimeTranscriptionProviders);
  const realtimeVoiceProviders = normalizeStringList(value.realtimeVoiceProviders);
  const mediaUnderstandingProviders = normalizeStringList(value.mediaUnderstandingProviders);
  const documentExtractors = normalizeStringList(value.documentExtractors);
  const imageGenerationProviders = normalizeStringList(value.imageGenerationProviders);
  const videoGenerationProviders = normalizeStringList(value.videoGenerationProviders);
  const musicGenerationProviders = normalizeStringList(value.musicGenerationProviders);
  const webContentExtractors = normalizeStringList(value.webContentExtractors);
  const webFetchProviders = normalizeStringList(value.webFetchProviders);
  const webSearchProviders = normalizeStringList(value.webSearchProviders);
  const migrationProviders = normalizeStringList(value.migrationProviders);
  const agentToolResultMiddleware = normalizeStringList(value.agentToolResultMiddleware);
  const tools = normalizeStringList(value.tools);
  const contracts = {
    ...(speechProviders.length > 0 ? { speechProviders } : {}),
    ...(realtimeTranscriptionProviders.length > 0 ? { realtimeTranscriptionProviders } : {}),
    ...(realtimeVoiceProviders.length > 0 ? { realtimeVoiceProviders } : {}),
    ...(mediaUnderstandingProviders.length > 0 ? { mediaUnderstandingProviders } : {}),
    ...(documentExtractors.length > 0 ? { documentExtractors } : {}),
    ...(imageGenerationProviders.length > 0 ? { imageGenerationProviders } : {}),
    ...(videoGenerationProviders.length > 0 ? { videoGenerationProviders } : {}),
    ...(musicGenerationProviders.length > 0 ? { musicGenerationProviders } : {}),
    ...(webContentExtractors.length > 0 ? { webContentExtractors } : {}),
    ...(webFetchProviders.length > 0 ? { webFetchProviders } : {}),
    ...(webSearchProviders.length > 0 ? { webSearchProviders } : {}),
    ...(migrationProviders.length > 0 ? { migrationProviders } : {}),
    ...(agentToolResultMiddleware.length > 0 ? { agentToolResultMiddleware } : {}),
    ...(tools.length > 0 ? { tools } : {}),
  } satisfies PluginManifestContracts;

  return Object.keys(contracts).length > 0 ? contracts : undefined;
}

function normalizeProviderAuthChoices(
  value: unknown,
): PluginManifestProviderAuthChoice[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized: PluginManifestProviderAuthChoice[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const provider = typeof entry.provider === "string" ? entry.provider.trim() : "";
    const method = typeof entry.method === "string" ? entry.method.trim() : "";
    const choiceId = typeof entry.choiceId === "string" ? entry.choiceId.trim() : "";
    if (!provider || !method || !choiceId) {
      continue;
    }
    const choiceLabel = typeof entry.choiceLabel === "string" ? entry.choiceLabel.trim() : "";
    const choiceHint = typeof entry.choiceHint === "string" ? entry.choiceHint.trim() : "";
    const deprecatedChoiceIds = normalizeStringList(entry.deprecatedChoiceIds);
    const groupId = typeof entry.groupId === "string" ? entry.groupId.trim() : "";
    const groupLabel = typeof entry.groupLabel === "string" ? entry.groupLabel.trim() : "";
    const groupHint = typeof entry.groupHint === "string" ? entry.groupHint.trim() : "";
    const optionKey = typeof entry.optionKey === "string" ? entry.optionKey.trim() : "";
    const cliFlag = typeof entry.cliFlag === "string" ? entry.cliFlag.trim() : "";
    const cliOption = typeof entry.cliOption === "string" ? entry.cliOption.trim() : "";
    const cliDescription =
      typeof entry.cliDescription === "string" ? entry.cliDescription.trim() : "";
    const onboardingScopes = normalizeStringList(entry.onboardingScopes).filter(
      (scope): scope is PluginManifestOnboardingScope =>
        scope === "text-inference" || scope === "image-generation",
    );
    normalized.push({
      provider,
      method,
      choiceId,
      ...(choiceLabel ? { choiceLabel } : {}),
      ...(choiceHint ? { choiceHint } : {}),
      ...(deprecatedChoiceIds.length > 0 ? { deprecatedChoiceIds } : {}),
      ...(groupId ? { groupId } : {}),
      ...(groupLabel ? { groupLabel } : {}),
      ...(groupHint ? { groupHint } : {}),
      ...(optionKey ? { optionKey } : {}),
      ...(cliFlag ? { cliFlag } : {}),
      ...(cliOption ? { cliOption } : {}),
      ...(cliDescription ? { cliDescription } : {}),
      ...(onboardingScopes.length > 0 ? { onboardingScopes } : {}),
    });
  }
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeManifestModelIdPrefixRules(
  value: unknown,
): PluginManifestModelIdPrefixRule[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const rules: PluginManifestModelIdPrefixRule[] = [];
  for (const rawRule of value) {
    if (!isRecord(rawRule)) {
      continue;
    }
    const modelPrefix = typeof rawRule.modelPrefix === "string" && rawRule.modelPrefix.trim() ? rawRule.modelPrefix.trim() : undefined;
    const prefix = typeof rawRule.prefix === "string" && rawRule.prefix.trim() ? rawRule.prefix.trim() : undefined;
    if (!modelPrefix || !prefix) {
      continue;
    }
    rules.push({ modelPrefix, prefix });
  }
  return rules.length > 0 ? rules : undefined;
}

function normalizeManifestModelIdNormalizationProvider(
  value: unknown,
): PluginManifestModelIdNormalizationProvider | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const aliases: Record<string, string> = {};
  if (isRecord(value.aliases)) {
    for (const [rawAlias, rawCanonical] of Object.entries(value.aliases)) {
      const alias = typeof rawAlias === "string" ? rawAlias.trim().toLowerCase() : "";
      const canonical = typeof rawCanonical === "string" && rawCanonical.trim() ? rawCanonical.trim() : undefined;
      if (alias && canonical) {
        aliases[alias] = canonical;
      }
    }
  }
  const stripPrefixes = normalizeStringList(value.stripPrefixes);
  const prefixWhenBare = typeof value.prefixWhenBare === "string" && value.prefixWhenBare.trim() ? value.prefixWhenBare.trim() : undefined;
  const prefixWhenBareAfterAliasStartsWith = normalizeManifestModelIdPrefixRules(
    value.prefixWhenBareAfterAliasStartsWith,
  );
  const normalization: PluginManifestModelIdNormalizationProvider = {
    ...(Object.keys(aliases).length > 0 ? { aliases } : {}),
    ...(stripPrefixes.length > 0 ? { stripPrefixes } : {}),
    ...(prefixWhenBare ? { prefixWhenBare } : {}),
    ...(prefixWhenBareAfterAliasStartsWith ? { prefixWhenBareAfterAliasStartsWith } : {}),
  };

  return Object.keys(normalization).length > 0 ? normalization : undefined;
}

function normalizeManifestModelIdNormalization(
  value: unknown,
  params: { ownedProviders: ReadonlySet<string> },
): PluginManifestModelIdNormalization | undefined {
  if (!isRecord(value) || !isRecord(value.providers)) {
    return undefined;
  }
  const ownedProviders = new Set(
    [...params.ownedProviders]
      .map((provider) => provider.trim().toLowerCase())
      .filter(Boolean),
  );
  const providers: Record<string, PluginManifestModelIdNormalizationProvider> = {};
  for (const [rawProviderId, rawPolicy] of Object.entries(value.providers)) {
    const providerId = rawProviderId.trim().toLowerCase();
    if (!providerId || !ownedProviders.has(providerId)) {
      continue;
    }
    const policy = normalizeManifestModelIdNormalizationProvider(rawPolicy);
    if (policy) {
      providers[providerId] = policy;
    }
  }
  return Object.keys(providers).length > 0 ? { providers } : undefined;
}

function normalizeChannelConfigs(
  value: unknown,
): Record<string, PluginManifestChannelConfig> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const normalized: Record<string, PluginManifestChannelConfig> = {};
  for (const [key, rawEntry] of Object.entries(value)) {
    const channelId = typeof key === "string" ? key.trim() : "";
    if (!channelId || !isRecord(rawEntry)) {
      continue;
    }
    const schema = isRecord(rawEntry.schema) ? rawEntry.schema : null;
    if (!schema) {
      continue;
    }
    const uiHints = isRecord(rawEntry.uiHints)
      ? (rawEntry.uiHints as Record<string, PluginConfigUiHint>)
      : undefined;
    const label = typeof rawEntry.label === "string" ? rawEntry.label.trim() : "";
    const description = typeof rawEntry.description === "string" ? rawEntry.description.trim() : "";
    const preferOver = normalizeStringList(rawEntry.preferOver);
    normalized[channelId] = {
      schema,
      ...(uiHints ? { uiHints } : {}),
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(preferOver.length > 0 ? { preferOver } : {}),
    };
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function resolvePluginManifestPath(rootDir: string): string {
  for (const filename of PLUGIN_MANIFEST_FILENAMES) {
    const candidate = path.join(rootDir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(rootDir, PLUGIN_MANIFEST_FILENAME);
}

function normalizeManifestConfigContracts(
  value: unknown,
): PluginManifestConfigContracts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const compatibilityMigrationPaths = normalizeStringList(value.compatibilityMigrationPaths);
  const compatibilityRuntimePaths = normalizeStringList(value.compatibilityRuntimePaths);
  const rawSecretInputs = isRecord(value.secretInputs) ? value.secretInputs : undefined;
  const dangerousFlags = Array.isArray(value.dangerousFlags)
    ? (value.dangerousFlags as PluginManifestDangerousConfigFlag[])
    : undefined;
  const secretInputs: PluginManifestSecretInputContracts | undefined = rawSecretInputs
    ? {
        ...(typeof rawSecretInputs.bundledDefaultEnabled === "boolean"
          ? { bundledDefaultEnabled: rawSecretInputs.bundledDefaultEnabled }
          : {}),
        paths: normalizeStringList(rawSecretInputs.paths),
      }
    : undefined;
  const configContracts: PluginManifestConfigContracts = {
    ...(compatibilityMigrationPaths.length > 0 ? { compatibilityMigrationPaths } : {}),
    ...(compatibilityRuntimePaths.length > 0 ? { compatibilityRuntimePaths } : {}),
    ...(dangerousFlags && dangerousFlags.length > 0 ? { dangerousFlags } : {}),
    ...(secretInputs ? { secretInputs } : {}),
  };
  return Object.keys(configContracts).length > 0 ? configContracts : undefined;
}

export function loadPluginManifest(
  rootDir: string,
  rejectHardlinks = true,
): PluginManifestLoadResult {
  const manifestPath = resolvePluginManifestPath(rootDir);
  const opened = openBoundaryFileSync({
    absolutePath: manifestPath,
    rootPath: rootDir,
    boundaryLabel: "plugin root",
    rejectHardlinks,
  });
  if (!opened.ok) {
    return matchBoundaryFileOpenFailure(opened, {
      path: () => ({
        ok: false,
        error: `plugin manifest not found: ${manifestPath}`,
        manifestPath,
      }),
      fallback: (failure) => ({
        ok: false,
        error: `unsafe plugin manifest path: ${manifestPath} (${failure.reason})`,
        manifestPath,
      }),
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(opened.fd, "utf-8")) as unknown;
  } catch (err) {
    return {
      ok: false,
      error: `failed to parse plugin manifest: ${String(err)}`,
      manifestPath,
    };
  } finally {
    fs.closeSync(opened.fd);
  }
  if (!isRecord(raw)) {
    return { ok: false, error: "plugin manifest must be an object", manifestPath };
  }
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) {
    return { ok: false, error: "plugin manifest requires id", manifestPath };
  }
  const configSchema = isRecord(raw.configSchema) ? raw.configSchema : null;
  if (!configSchema) {
    return { ok: false, error: "plugin manifest requires configSchema", manifestPath };
  }

  const kind = typeof raw.kind === "string" ? (raw.kind as PluginKind) : undefined;
  const enabledByDefault = raw.enabledByDefault === true;
  const legacyPluginIds = normalizeStringList(raw.legacyPluginIds);
  const autoEnableWhenConfiguredProviders = normalizeStringList(
    raw.autoEnableWhenConfiguredProviders,
  );
  const name = typeof raw.name === "string" ? raw.name.trim() : undefined;
  const description = typeof raw.description === "string" ? raw.description.trim() : undefined;
  const version = typeof raw.version === "string" ? raw.version.trim() : undefined;
  const channels = normalizeStringList(raw.channels);
  const providers = normalizeStringList(raw.providers);
  const cliBackends = normalizeStringList(raw.cliBackends);
  const providerAuthEnvVars = normalizeStringListRecord(raw.providerAuthEnvVars);
  const providerAuthChoices = normalizeProviderAuthChoices(raw.providerAuthChoices);
  const skills = normalizeStringList(raw.skills);
  const contracts = normalizeManifestContracts(raw.contracts);
  const configContracts = normalizeManifestConfigContracts(raw.configContracts);
  const channelConfigs = normalizeChannelConfigs(raw.channelConfigs);
  const modelIdNormalization = normalizeManifestModelIdNormalization(raw.modelIdNormalization, {
    ownedProviders: new Set(providers),
  });
  const modelCatalog = isRecord(raw.modelCatalog) ? (raw.modelCatalog as PluginManifestModelCatalog) : undefined;
  const toolMetadata = isRecord(raw.toolMetadata) ? (raw.toolMetadata as Record<string, PluginManifestToolMetadata>) : undefined;
  const enabledByDefaultOnPlatforms = normalizeStringList(raw.enabledByDefaultOnPlatforms);

  let uiHints: Record<string, PluginConfigUiHint> | undefined;
  if (isRecord(raw.uiHints)) {
    uiHints = raw.uiHints as Record<string, PluginConfigUiHint>;
  }

  return {
    ok: true,
    manifest: {
      id,
      configSchema,
      ...(enabledByDefault ? { enabledByDefault } : {}),
      ...(enabledByDefaultOnPlatforms.length > 0 ? { enabledByDefaultOnPlatforms } : {}),
      ...(legacyPluginIds.length > 0 ? { legacyPluginIds } : {}),
      ...(autoEnableWhenConfiguredProviders.length > 0
        ? { autoEnableWhenConfiguredProviders }
        : {}),
      kind,
      channels,
      providers,
      cliBackends,
      providerAuthEnvVars,
      providerAuthChoices,
      skills,
      name,
      description,
      version,
      uiHints,
      contracts,
      configContracts,
      modelCatalog,
      modelIdNormalization,
      toolMetadata,
      channelConfigs,
    },
    manifestPath,
  };
}

// package.json "coreblow" metadata (used for setup/catalog)
export type PluginPackageChannel = {
  id?: string;
  label?: string;
  selectionLabel?: string;
  detailLabel?: string;
  docsPath?: string;
  docsLabel?: string;
  blurb?: string;
  order?: number;
  aliases?: string[];
  preferOver?: string[];
  systemImage?: string;
  selectionDocsPrefix?: string;
  selectionDocsOmitLabel?: boolean;
  selectionExtras?: string[];
  showConfigured?: boolean;
  quickstartAllowFrom?: boolean;
  forceAccountBinding?: boolean;
  preferSessionLookupForAnnounceTarget?: boolean;
  commands?: PluginManifestChannelCommandDefaults;
  configuredState?: PluginPackageChannelStateProbe;
  persistedAuthState?: PluginPackageChannelStateProbe;
};

export type PluginPackageChannelStateProbe = {
  specifier?: string;
  exportName?: string;
  env?: {
    allOf?: string[];
    anyOf?: string[];
  };
};

export type PluginPackageInstall = {
  corehubSpec?: string;
  clawhubSpec?: string;
  npmSpec?: string;
  localPath?: string;
  defaultChoice?: "corehub" | "clawhub" | "npm" | "local";
  minHostVersion?: string;
  expectedIntegrity?: string;
  allowInvalidConfigRecovery?: boolean;
};

export type CoreBlowPackageStartup = {
  /**
   * Opt-in for channel plugins whose `setupEntry` fully covers the gateway
   * startup surface needed before the server starts listening.
   */
  deferConfiguredChannelFullLoadUntilAfterListen?: boolean;
};

export type CoreBlowPackageSetupFeatures = {
  cliBackends?: string[];
  providers?: string[];
};

export type CoreBlowPackageManifest = {
  extensions?: string[];
  runtimeExtensions?: string[];
  setupEntry?: string;
  runtimeSetupEntry?: string;
  setupFeatures?: CoreBlowPackageSetupFeatures;
  plugin?: {
    id?: string;
    label?: string;
  };
  channel?: PluginPackageChannel;
  install?: PluginPackageInstall;
  startup?: CoreBlowPackageStartup;
};

export type OpenClawPackageManifest = CoreBlowPackageManifest;

export const DEFAULT_PLUGIN_ENTRY_CANDIDATES = [
  "index.ts",
  "index.js",
  "index.mjs",
  "index.cjs",
] as const;

export type PackageExtensionResolution =
  | { status: "ok"; entries: string[] }
  | { status: "missing"; entries: [] }
  | { status: "empty"; entries: [] };

export type ManifestKey = typeof MANIFEST_KEY;

export type PackageManifest = {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} & Partial<Record<ManifestKey | "openclaw", CoreBlowPackageManifest>>;

export function getPackageManifestMetadata(
  manifest: PackageManifest | undefined,
): CoreBlowPackageManifest | undefined {
  if (!manifest) {
    return undefined;
  }
  return manifest[MANIFEST_KEY] ?? manifest["openclaw" as ManifestKey];
}

export function resolvePackageExtensionEntries(
  manifest: PackageManifest | undefined,
): PackageExtensionResolution {
  const raw = getPackageManifestMetadata(manifest)?.extensions;
  if (!Array.isArray(raw)) {
    return { status: "missing", entries: [] };
  }
  const entries = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  if (entries.length === 0) {
    return { status: "empty", entries: [] };
  }
  return { status: "ok", entries };
}
