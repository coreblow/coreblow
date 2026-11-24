/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { ChannelSetupWizard } from "../channels/plugins/setup-wizard.js";
import type { ChannelSetupAdapter } from "../channels/plugins/types.adapters.js";
import type { GroupPolicy } from "../config/types.js";
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";

type FacadeModule = {
  evaluateZaloGroupAccess: (...args: unknown[]) => unknown;
  resolveZaloRuntimeGroupPolicy: (params: {
    providerConfigPresent: boolean;
    groupPolicy?: GroupPolicy;
    defaultGroupPolicy?: GroupPolicy;
  }) => {
    groupPolicy: GroupPolicy;
    providerMissingFallbackApplied: boolean;
  };
  zaloSetupAdapter: ChannelSetupAdapter;
  zaloSetupWizard: ChannelSetupWizard;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "zalo",
    artifactBasename: "api.js",
  });
}

export const evaluateZaloGroupAccess: FacadeModule["evaluateZaloGroupAccess"] =
  createLazyFacadeValue(loadFacadeModule, "evaluateZaloGroupAccess");
export const resolveZaloRuntimeGroupPolicy: FacadeModule["resolveZaloRuntimeGroupPolicy"] =
  createLazyFacadeValue(loadFacadeModule, "resolveZaloRuntimeGroupPolicy");
export const zaloSetupAdapter: FacadeModule["zaloSetupAdapter"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().zaloSetupAdapter,
);
export const zaloSetupWizard: FacadeModule["zaloSetupWizard"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().zaloSetupWizard,
);
