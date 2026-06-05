import type { PluginRegistry } from "./registry.js";

export function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    agentToolResultMiddlewares: [],
    hooks: [],
    typedHooks: [],
    channels: [],
    channelSetups: [],
    providers: [],
    cliBackends: [],
    speechProviders: [],
    mediaUnderstandingProviders: [],
    imageGenerationProviders: [],
    videoGenerationProviders: [],
    musicGenerationProviders: [],
    webSearchProviders: [],
    gatewayHandlers: {},
    gatewayMethodScopes: {},
    httpRoutes: [],
    cliRegistrars: [],
    services: [],
    commands: [],
    nodeHostCommands: [],
    nodeInvokePolicies: [],
    conversationBindingResolvedHandlers: [],
    diagnostics: [],
  };
}
