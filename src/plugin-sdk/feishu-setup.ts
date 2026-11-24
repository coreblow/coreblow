/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { ChannelSetupWizard } from "../channels/plugins/setup-wizard.js";
import type { ChannelSetupAdapter } from "../channels/plugins/types.adapters.js";
import { createLazyFacadeObjectValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

type FacadeModule = {
  feishuSetupAdapter: ChannelSetupAdapter;
  feishuSetupWizard: ChannelSetupWizard;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "feishu",
    artifactBasename: "api.js",
  });
}

export const feishuSetupAdapter: FacadeModule["feishuSetupAdapter"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().feishuSetupAdapter,
);
export const feishuSetupWizard: FacadeModule["feishuSetupWizard"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().feishuSetupWizard,
);
