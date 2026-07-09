/**
 * Web fetch provider contract test helper.
 *
 * CoreBlow intentionally does not have WebFetchProviderPlugin.
 * Web fetch tooling is consolidated under WebSearchProviderPlugin.
 * This module provides the parity surface with a no-op implementation.
 */

export function describeWebFetchProviderContracts(_pluginId: string): void {
  // No-op: CoreBlow has no WebFetchProviderPlugin concept.
  // Web fetch provider contracts are tested through WebSearchProviderPlugin.
}
