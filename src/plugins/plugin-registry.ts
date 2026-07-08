// Barrel: re-exports plugin registry surface for consumers expecting this path.
// In OpenClaw this re-exports plugin-registry-contributions.js and plugin-registry-snapshot.js.
// CoreBlow has PluginRegistry/PluginRecord in registry.ts.

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
