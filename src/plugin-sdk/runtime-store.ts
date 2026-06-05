export type { PluginRuntime } from "../plugins/runtime/types.js";

/** Create a tiny mutable runtime slot with strict access when the runtime has not been initialized. */
export function createPluginRuntimeStore<T>(
  errorMessage:
    | string
    | {
        errorMessage: string;
        pluginId?: string;
      },
): {
  setRuntime: (next: T) => void;
  clearRuntime: () => void;
  tryGetRuntime: () => T | null;
  getRuntime: () => T;
} {
  const message = typeof errorMessage === "string" ? errorMessage : errorMessage.errorMessage;
  let runtime: T | null = null;

  return {
    setRuntime(next: T) {
      runtime = next;
    },
    clearRuntime() {
      runtime = null;
    },
    tryGetRuntime() {
      return runtime;
    },
    getRuntime() {
      if (!runtime) {
        throw new Error(message);
      }
      return runtime;
    },
  };
}
