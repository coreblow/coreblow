import { describe, expect, it } from "vitest";
import {
  pluginRegistrationContractRegistry,
} from "../../plugins/contracts/registry.js";
import { installWebSearchProviderContractSuite } from "./provider-contract-suites.js";

function resolveWebSearchCredentialValue(provider: {
  id: string;
  requiresCredential?: boolean;
  envVars: readonly string[];
}): unknown {
  if (provider.requiresCredential === false) {
    return `${provider.id}-no-key-needed`;
  }
  const envVar = provider.envVars.find((entry) => entry.trim().length > 0);
  if (!envVar) {
    return `${provider.id}-test`;
  }
  if (envVar === "OPENROUTER_API_KEY") {
    return "openrouter-test";
  }
  return envVar.toLowerCase().includes("api_key") ? `${provider.id}-test` : "sk-test";
}

export function describeWebSearchProviderContracts(pluginId: string) {
  const providerIds =
    pluginRegistrationContractRegistry.find((entry) => entry.pluginId === pluginId)
      ?.webSearchProviderIds ?? [];

  describe(`${pluginId} web search provider contract registry load`, () => {
    it("has registered web search provider ids", () => {
      expect(providerIds.length).toBeGreaterThan(0);
    });
  });

  for (const providerId of providerIds) {
    describe(`${pluginId}:${providerId} web search contract`, () => {
      installWebSearchProviderContractSuite({
        provider: () => {
          throw new Error(
            `web search provider contract suite requires a resolved provider for ${pluginId}:${providerId}; ` +
            `pass the provider directly to installWebSearchProviderContractSuite in the test file`,
          );
        },
        credentialValue: () => resolveWebSearchCredentialValue({ id: providerId, envVars: [] }),
      });
    });
  }
}
