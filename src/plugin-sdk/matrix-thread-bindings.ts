/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { SessionBindingRecord } from "../infra/outbound/session-binding-service.js";
import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

type FacadeModule = {
  setMatrixThreadBindingIdleTimeoutBySessionKey: (params: {
    targetSessionKey: string;
    accountId: string;
    idleTimeoutMs: number;
  }) => SessionBindingRecord[];
  setMatrixThreadBindingMaxAgeBySessionKey: (params: {
    targetSessionKey: string;
    accountId: string;
    maxAgeMs: number;
  }) => SessionBindingRecord[];
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "matrix",
    artifactBasename: "api.js",
  });
}

export const setMatrixThreadBindingIdleTimeoutBySessionKey: FacadeModule["setMatrixThreadBindingIdleTimeoutBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "setMatrixThreadBindingIdleTimeoutBySessionKey");
export const setMatrixThreadBindingMaxAgeBySessionKey: FacadeModule["setMatrixThreadBindingMaxAgeBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "setMatrixThreadBindingMaxAgeBySessionKey");
