/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { PluginRuntime } from "../plugins/runtime/types.js";
import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

export { resolveMatrixAccountStringValues } from "../infra/matrix-account-core.js";

type FacadeModule = {
  setMatrixRuntime: (runtime: PluginRuntime) => void;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "matrix",
    artifactBasename: "runtime-api.js",
  });
}

export const setMatrixRuntime: FacadeModule["setMatrixRuntime"] = createLazyFacadeValue(
  loadFacadeModule,
  "setMatrixRuntime",
);
