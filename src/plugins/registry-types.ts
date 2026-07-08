// False gap: CoreBlow PluginRegistry/PluginRecord types live in registry.ts.
// This barrel exists for OpenClaw parity consumers importing from registry-types.ts.

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
