import { createPluginRuntimeStore } from "coreblow/plugin-sdk/runtime-store";
import type { PluginRuntime } from "coreblow/plugin-sdk/core";

const {
  setRuntime: setSlackRuntime,
  clearRuntime: clearSlackRuntime,
  getRuntime: getSlackRuntime,
} = createPluginRuntimeStore<PluginRuntime>("Slack runtime not initialized");

export { clearSlackRuntime, getSlackRuntime, setSlackRuntime };
