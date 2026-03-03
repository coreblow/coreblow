import { createPluginRuntimeStore } from "coreblow/plugin-sdk/runtime-store";
import type { PluginRuntime } from "coreblow/plugin-sdk/core";

const {
  setRuntime: setTelegramRuntime,
  clearRuntime: clearTelegramRuntime,
  getRuntime: getTelegramRuntime,
} = createPluginRuntimeStore<PluginRuntime>("Telegram runtime not initialized");

export { clearTelegramRuntime, getTelegramRuntime, setTelegramRuntime };
