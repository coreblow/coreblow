import { createCapturedPluginRegistration } from "../plugins/captured-registration.js";
import { createEmptyPluginRegistry } from "../plugins/registry.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import type { CoreBlowPluginApi, ProviderPlugin } from "../plugins/types.js";

export { createCapturedPluginRegistration };

type RegistrablePlugin = {
  register(api: CoreBlowPluginApi): void;
};

function syncActiveProviderRegistry(providers: ProviderPlugin[]): void {
  const registry = createEmptyPluginRegistry();
  registry.providers = providers.map((provider) => ({
    pluginId: provider.id,
    source: "test",
    provider,
  }));
  setActivePluginRegistry(registry);
}

export function registerSingleProviderPlugin(params: {
  register(api: CoreBlowPluginApi): void;
}): ProviderPlugin {
  const captured = createCapturedPluginRegistration();
  params.register(captured.api);
  const provider = captured.providers[0];
  if (!provider) {
    throw new Error("provider registration missing");
  }
  syncActiveProviderRegistry(captured.providers);
  return provider;
}

export function registerProviderPlugins(...plugins: RegistrablePlugin[]): ProviderPlugin[] {
  const captured = createCapturedPluginRegistration();
  for (const plugin of plugins) {
    plugin.register(captured.api);
  }
  syncActiveProviderRegistry(captured.providers);
  return captured.providers;
}

export function requireRegisteredProvider(providers: ProviderPlugin[], providerId: string) {
  const provider = providers.find((entry) => entry.id === providerId);
  if (!provider) {
    throw new Error(`provider ${providerId} missing`);
  }
  return provider;
}
