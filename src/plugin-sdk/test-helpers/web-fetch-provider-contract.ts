import { describeWebSearchProviderContracts } from "./web-search-provider-contract.js";

/**
 * Web fetch provider contract test helper.
 *
 * CoreBlow intentionally does not implement WebFetchProviderPlugin.
 * Web fetch tooling is consolidated under WebSearchProviderPlugin.
 * This contract delegates directly to the WebSearch contract suite to
 * validate fetch-capable providers using native architecture.
 */
export function describeWebFetchProviderContracts(pluginId: string): void {
  describeWebSearchProviderContracts(pluginId);
}
