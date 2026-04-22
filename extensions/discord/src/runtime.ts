import { createPluginRuntimeStore } from "coreblow/plugin-sdk/runtime-store";
import type { PluginRuntime } from "coreblow/plugin-sdk/core";

const { setRuntime: setDiscordRuntime, getRuntime: getDiscordRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Discord runtime not initialized");

export { getDiscordRuntime, setDiscordRuntime };
