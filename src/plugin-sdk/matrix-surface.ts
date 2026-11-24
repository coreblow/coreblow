/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

type FacadeModule = {
  createMatrixThreadBindingManager: (params: Record<string, unknown>) => {
    stop: () => void;
    [key: string]: unknown;
  };
  resetMatrixThreadBindingsForTests: () => void;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "matrix",
    artifactBasename: "api.js",
  });
}

export const createMatrixThreadBindingManager: FacadeModule["createMatrixThreadBindingManager"] =
  createLazyFacadeValue(loadFacadeModule, "createMatrixThreadBindingManager");
export const matrixSessionBindingAdapterChannels = ["matrix"] as const;
export const resetMatrixThreadBindingsForTests: FacadeModule["resetMatrixThreadBindingsForTests"] =
  createLazyFacadeValue(loadFacadeModule, "resetMatrixThreadBindingsForTests");
