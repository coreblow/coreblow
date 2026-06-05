import type { CoreBlowPluginApi } from "coreblow/plugin-sdk/plugin-entry";
import anthropicProviderDiscovery from "./provider-discovery.js";

export function registerAnthropicRuntimeFacades(api: CoreBlowPluginApi): void {
  api.registerProvider(anthropicProviderDiscovery);
}
