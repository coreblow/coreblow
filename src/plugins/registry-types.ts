// False gap: CoreBlow PluginRegistry/PluginRecord types live in registry.ts.
// This barrel exists for OpenClaw parity consumers importing from registry-types.ts.

export type {
  PluginRecord,
  PluginRegistry,
  PluginRegistryParams,
  PluginToolRegistration,
  PluginChannelRegistration,
  PluginChannelSetupRegistration,
  PluginProviderRegistration,
  PluginCliBackendRegistration,
  PluginSpeechProviderRegistration,
  PluginMediaUnderstandingProviderRegistration,
  PluginImageGenerationProviderRegistration,
  PluginVideoGenerationProviderRegistration,
  PluginWebSearchProviderRegistration,
  PluginAgentToolResultMiddlewareRegistration,
  PluginSessionExtensionRegistryRegistration,
  PluginTrustedToolPolicyRegistryRegistration,
  PluginToolMetadataRegistryRegistration,
  PluginControlUiDescriptorRegistryRegistration,
  PluginRuntimeLifecycleRegistryRegistration,
  PluginAgentEventSubscriptionRegistryRegistration,
  PluginSessionSchedulerJobRegistryRegistration,
  PluginSessionActionRegistryRegistration,
} from "./registry.js";
