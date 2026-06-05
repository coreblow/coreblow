import type { CoreBlowConfig } from "../config/config.js";
import { emptyPluginConfigSchema } from "../plugins/config-schema.js";
import type {
  AgentToolResultMiddleware,
  AgentToolResultMiddlewareEvent,
  AgentToolResultMiddlewareOptions,
  AgentToolResultMiddlewareResult,
  AgentToolResultMiddlewareRuntime,
  AnyAgentTool,
  MediaUnderstandingProviderPlugin,
  MusicGenerationProviderPlugin,
  CoreBlowPluginApi,
  CoreBlowPluginCommandDefinition,
  CoreBlowPluginConfigSchema,
  CoreBlowPluginDefinition,
  CoreBlowPluginService,
  CoreBlowPluginServiceContext,
  CoreBlowPluginToolContext,
  CoreBlowPluginToolFactory,
  PluginInteractiveTelegramHandlerContext,
  PluginLogger,
  ProviderAugmentModelCatalogContext,
  ProviderAuthContext,
  ProviderAuthDoctorHintContext,
  ProviderAuthMethod,
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthResult,
  ProviderBuildMissingAuthMessageContext,
  ProviderBuildUnknownModelHintContext,
  ProviderBuiltInModelSuppressionContext,
  ProviderBuiltInModelSuppressionResult,
  ProviderCacheTtlEligibilityContext,
  ProviderCatalogContext,
  ProviderCatalogResult,
  ProviderDefaultThinkingPolicyContext,
  ProviderDiscoveryContext,
  ProviderFetchUsageSnapshotContext,
  ProviderModernModelPolicyContext,
  ProviderNormalizeConfigContext,
  ProviderNormalizeTransportContext,
  ProviderResolveConfigApiKeyContext,
  ProviderNormalizeModelIdContext,
  ProviderNormalizeResolvedModelContext,
  ProviderPrepareDynamicModelContext,
  ProviderPrepareExtraParamsContext,
  ProviderPrepareRuntimeAuthContext,
  ProviderPreparedRuntimeAuth,
  ProviderResolvedUsageAuth,
  ProviderResolveDynamicModelContext,
  ProviderResolveUsageAuthContext,
  ProviderRuntimeModel,
  ProviderThinkingPolicyContext,
  ProviderWrapStreamFnContext,
  SpeechProviderPlugin,
  PluginCommandContext,
} from "../plugins/types.js";

export type {
  AgentToolResultMiddleware,
  AgentToolResultMiddlewareEvent,
  AgentToolResultMiddlewareOptions,
  AgentToolResultMiddlewareResult,
  AgentToolResultMiddlewareRuntime,
  AnyAgentTool,
  MediaUnderstandingProviderPlugin,
  MusicGenerationProviderPlugin,
  CoreBlowPluginApi,
  CoreBlowPluginToolContext,
  CoreBlowPluginToolFactory,
  PluginCommandContext,
  CoreBlowPluginConfigSchema,
  ProviderDiscoveryContext,
  ProviderCatalogContext,
  ProviderCatalogResult,
  ProviderAugmentModelCatalogContext,
  ProviderBuiltInModelSuppressionContext,
  ProviderBuiltInModelSuppressionResult,
  ProviderBuildMissingAuthMessageContext,
  ProviderBuildUnknownModelHintContext,
  ProviderCacheTtlEligibilityContext,
  ProviderDefaultThinkingPolicyContext,
  ProviderFetchUsageSnapshotContext,
  ProviderModernModelPolicyContext,
  ProviderNormalizeConfigContext,
  ProviderNormalizeTransportContext,
  ProviderResolveConfigApiKeyContext,
  ProviderNormalizeModelIdContext,
  ProviderPreparedRuntimeAuth,
  ProviderResolvedUsageAuth,
  ProviderPrepareExtraParamsContext,
  ProviderPrepareDynamicModelContext,
  ProviderPrepareRuntimeAuthContext,
  ProviderResolveUsageAuthContext,
  ProviderResolveDynamicModelContext,
  ProviderNormalizeResolvedModelContext,
  ProviderRuntimeModel,
  SpeechProviderPlugin,
  ProviderThinkingPolicyContext,
  ProviderWrapStreamFnContext,
  CoreBlowPluginService,
  CoreBlowPluginServiceContext,
  ProviderAuthContext,
  ProviderAuthDoctorHintContext,
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthMethod,
  ProviderAuthResult,
  CoreBlowPluginCommandDefinition,
  CoreBlowPluginDefinition,
  PluginLogger,
  PluginInteractiveTelegramHandlerContext,
};
export type { CoreBlowConfig };
export type {
  MigrationItem,
  MigrationSummary,
} from "./migration.js";
export type {
  MigrationApplyResult,
  MigrationPlan,
} from "./migration-runtime.js";

export type MigrationProviderContext = {
  source?: string;
  stateDir: string;
  workspaceDir?: string;
  agentDir?: string;
  reportDir?: string;
  backupPath?: string;
  overwrite?: boolean;
  includeSecrets?: boolean;
  config: CoreBlowConfig;
  runtime?: {
    agent?: {
      resolveAgentWorkspaceDir?: (config: CoreBlowConfig, agentId: string) => string;
      resolveAgentDir?: (config: CoreBlowConfig, agentId: string) => string;
    };
    config?: unknown;
  };
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
    debug?: (message: string) => void;
  };
};

export type MigrationProviderPlugin = {
  id: string;
  label: string;
  description?: string;
  detect: (ctx: MigrationProviderContext) => Promise<{
    found: boolean;
    source?: string;
    label?: string;
    confidence?: string;
    message?: string;
  }>;
  plan: (ctx: MigrationProviderContext) => Promise<import("./migration-runtime.js").MigrationPlan>;
  apply: (
    ctx: MigrationProviderContext,
    plan?: import("./migration-runtime.js").MigrationPlan,
  ) => Promise<import("./migration-runtime.js").MigrationApplyResult>;
};

export { emptyPluginConfigSchema } from "../plugins/config-schema.js";

/** Options for a plugin entry that registers providers, tools, commands, or services. */
type DefinePluginEntryOptions = {
  id: string;
  name: string;
  description: string;
  kind?: CoreBlowPluginDefinition["kind"];
  configSchema?: CoreBlowPluginConfigSchema | (() => CoreBlowPluginConfigSchema);
  register: (api: CoreBlowPluginApi) => void;
};

/** Normalized object shape that CoreBlow loads from a plugin entry module. */
type DefinedPluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: CoreBlowPluginConfigSchema;
  register: NonNullable<CoreBlowPluginDefinition["register"]>;
} & Pick<CoreBlowPluginDefinition, "kind">;

/** Resolve either a concrete config schema or a lazy schema factory. */
function resolvePluginConfigSchema(
  configSchema: DefinePluginEntryOptions["configSchema"] = emptyPluginConfigSchema,
): CoreBlowPluginConfigSchema {
  return typeof configSchema === "function" ? configSchema() : configSchema;
}

/**
 * Canonical entry helper for non-channel plugins.
 *
 * Use this for provider, tool, command, service, memory, and context-engine
 * plugins. Channel plugins should use `defineChannelPluginEntry(...)` from
 * `coreblow/plugin-sdk/core` so they inherit the channel capability wiring.
 */
export function definePluginEntry({
  id,
  name,
  description,
  kind,
  configSchema = emptyPluginConfigSchema,
  register,
}: DefinePluginEntryOptions): DefinedPluginEntry {
  return {
    id,
    name,
    description,
    ...(kind ? { kind } : {}),
    configSchema: resolvePluginConfigSchema(configSchema),
    register,
  };
}
