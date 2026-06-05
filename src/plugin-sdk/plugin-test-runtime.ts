export function createRuntimeTaskFlow() {
  const flows: unknown[] = [];
  return {
    flows,
    async createFlow(input: unknown) {
      flows.push(input);
      return { flowId: `flow-${flows.length}`, revision: 0, ...(input as object) };
    },
  };
}

import { capturePluginRegistration } from "../plugins/captured-registration.js";
import type { CoreBlowPluginApi, ProviderPlugin } from "../plugins/types.js";

type TestPluginEntry = {
  register?: (api: CoreBlowPluginApi) => void | Promise<void>;
};

export async function registerProviderPlugin(params: {
  plugin: TestPluginEntry;
  id?: string;
  name?: string;
}) {
  const captured = capturePluginRegistration({ register: (api) => params.plugin.register?.(api) });
  return {
    providers: captured.providers,
    speechProviders: captured.speechProviders,
    mediaProviders: captured.mediaUnderstandingProviders,
    imageProviders: captured.imageGenerationProviders,
    videoProviders: captured.videoGenerationProviders,
    musicProviders: captured.musicGenerationProviders,
    webSearchProviders: captured.webSearchProviders,
  };
}

export async function registerSingleProviderPlugin(plugin: TestPluginEntry): Promise<ProviderPlugin> {
  const captured = await registerProviderPlugin({ plugin });
  const provider = captured.providers[0];
  if (!provider) {
    throw new Error("expected provider registration");
  }
  return provider;
}

export function requireRegisteredProvider<T extends { id: string }>(
  providers: readonly T[],
  id: string,
): T {
  const provider = providers.find((entry) => entry.id === id);
  if (!provider) {
    throw new Error(`expected ${id} provider to be registered`);
  }
  return provider;
}

export function resolveProviderPluginChoice(params: {
  providers: readonly ProviderPlugin[];
  choice: string;
}): { provider: ProviderPlugin; method: NonNullable<ProviderPlugin["auth"]>[number] } | undefined {
  for (const provider of params.providers) {
    for (const method of provider.auth ?? []) {
      const methodWithCompatId = method as NonNullable<ProviderPlugin["auth"]>[number] & {
        id?: string;
        methodId?: string;
      };
      if ((methodWithCompatId.id ?? methodWithCompatId.methodId) === params.choice) {
        return { provider, method: { ...methodWithCompatId, id: methodWithCompatId.id ?? methodWithCompatId.methodId } };
      }
    }
  }
  return undefined;
}
