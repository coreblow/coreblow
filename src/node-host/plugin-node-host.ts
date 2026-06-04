import type { CoreBlowConfig } from "../config/config.js";
import { loadCoreBlowPlugins } from "../plugins/loader.js";
import { getActivePluginRegistry, setActivePluginRegistry } from "../plugins/runtime.js";

let pluginRegistryLoaderPromise: Promise<typeof import("../plugins/loader.js")> | undefined;

async function loadPluginRegistryLoaderModule() {
  pluginRegistryLoaderPromise ??= import("../plugins/loader.js");
  return await pluginRegistryLoaderPromise;
}

export async function ensureNodeHostPluginRegistry(params: {
  config: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  if (getActivePluginRegistry()) {
    return;
  }
  const loader = await loadPluginRegistryLoaderModule();
  const registry = loader.loadCoreBlowPlugins({
    config: params.config,
    env: params.env,
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
  });
  setActivePluginRegistry(registry);
}

export function listRegisteredNodeHostCapsAndCommands(): {
  caps: string[];
  commands: string[];
} {
  const registry = getActivePluginRegistry();
  const caps = new Set<string>();
  const commands = new Set<string>();
  for (const entry of registry?.nodeHostCommands ?? []) {
    if (entry.command.cap) {
      caps.add(entry.command.cap);
    }
    commands.add(entry.command.command);
  }
  return {
    caps: [...caps].toSorted((left, right) => left.localeCompare(right)),
    commands: [...commands].toSorted((left, right) => left.localeCompare(right)),
  };
}

export async function invokeRegisteredNodeHostCommand(
  command: string,
  paramsJSON?: string | null,
): Promise<string | null> {
  const registry = getActivePluginRegistry();
  const match = (registry?.nodeHostCommands ?? []).find(
    (entry) => entry.command.command === command,
  );
  if (!match) {
    return null;
  }
  return await match.command.handle(paramsJSON);
}
