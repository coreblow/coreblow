import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../testing.js";
import { runProviderCatalog } from "../testing.js";
import type { ProviderPlugin } from "../../plugins/types.js";

/**
 * Provider discovery contract test helper.
 *
 * Provides a generic CoreBlow-native suite to validate that a provider
 * correctly implements catalog discovery (resolving auth, models, and baseUrl).
 */
export function describeProviderDiscoveryContract(params: {
  provider: ProviderPlugin;
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  mockApiKey?: string;
  expectedBaseUrl?: string;
  expectedModels?: string[];
}): void {
  describe(`${params.provider.id} provider discovery contract`, () => {
    it("runs discovery catalog and respects injected auth and config", async () => {
      const result = await runProviderCatalog({
        provider: params.provider,
        config: params.config ?? ({} as CoreBlowConfig),
        env: params.env ?? {},
        resolveProviderApiKey: () => ({
          apiKey: params.mockApiKey,
          discoveryApiKey: params.mockApiKey,
        }),
        resolveProviderAuth: () => ({
          apiKey: params.mockApiKey,
          discoveryApiKey: params.mockApiKey,
          mode: params.mockApiKey ? "api_key" : "none",
          source: params.mockApiKey ? "env" : "none",
        }),
      });

      if (!params.mockApiKey && !params.config?.models?.providers?.[params.provider.id]) {
        // Without auth or explicit config, catalog discovery is typically skipped
        return;
      }

      expect(result).not.toBeNull();
      if (result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = result as any;
        const discoveredProvider = res.provider ?? res.providers?.[params.provider.id];
        if (discoveredProvider) {
          if (params.expectedBaseUrl) {
            expect(discoveredProvider.baseUrl).toBe(params.expectedBaseUrl);
          }
          if (params.expectedModels && discoveredProvider.models) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const discoveredIds = discoveredProvider.models.map((m: any) => m.id);
            for (const expectedModel of params.expectedModels) {
              expect(discoveredIds).toContain(expectedModel);
            }
          }
        }
      }
    });
  });
}
