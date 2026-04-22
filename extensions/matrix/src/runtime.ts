import { createPluginRuntimeStore } from "coreblow/plugin-sdk/runtime-store";
import type { PluginRuntime } from "coreblow/plugin-sdk/matrix";

const { setRuntime: setMatrixRuntime, getRuntime: getMatrixRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Matrix runtime not initialized");

export { getMatrixRuntime, setMatrixRuntime };
