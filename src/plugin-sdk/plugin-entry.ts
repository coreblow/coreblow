import type { CoreBlowConfig } from "../config/config.js";
import { emptyPluginConfigSchema } from "../plugins/config-schema.js";
import type {
  AnyAgentTool,
  MediaUnderstandingProviderPlugin,
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
  AnyAgentTool,
  MediaUnderstandingProviderPlugin,
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
