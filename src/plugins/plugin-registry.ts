export * from "./plugin-registry-contributions.js";
export * from "./plugin-registry-snapshot.js";

export type {
  PluginRecord,
  PluginRegistry,
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
} from "./registry.js";
