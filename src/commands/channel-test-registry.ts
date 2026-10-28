import {
  getBundledChannelPlugin,
  listBundledChannelPluginIds,
  setBundledChannelRuntime,
} from "../channels/plugins/bundled.js";
import type { ChannelId, ChannelPlugin } from "../channels/plugins/types.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import type { PluginRuntime } from "../plugins/runtime/index.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";

function resolveChannelPluginsForTests(onlyPluginIds?: readonly ChannelId[]) {
  const ids = onlyPluginIds ?? listBundledChannelPluginIds();
  return ids.flatMap((id: ChannelId) => {
    const plugin = getBundledChannelPlugin(id);
    return plugin ? [plugin] : [];
  });
}

function createChannelTestRuntime(): PluginRuntime {
  return {
    state: {
      resolveStateDir: (_env, homeDir) => (homeDir ?? (() => "/tmp"))(),
    },
  } as PluginRuntime;
}

function setChannelPluginRegistryForTests(onlyPluginIds?: readonly ChannelId[]): void {
  const plugins = resolveChannelPluginsForTests(onlyPluginIds);
  const runtime = createChannelTestRuntime();
  for (const plugin of plugins) {
    try {
      setBundledChannelRuntime(plugin.id, runtime);
    } catch {
      // Most bundled channels do not need a runtime setter for contract tests.
    }
  }

  const channels = plugins.map((plugin: ChannelPlugin) => ({
    pluginId: plugin.id,
    plugin,
    source: "test" as const,
  })) as unknown as Parameters<typeof createTestRegistry>[0];
  setActivePluginRegistry(createTestRegistry(channels));
}

export function setDefaultChannelPluginRegistryForTests(): void {
  setChannelPluginRegistryForTests();
}

export { setChannelPluginRegistryForTests };
