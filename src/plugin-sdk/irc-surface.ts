/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { ChannelSetupWizard } from "../channels/plugins/setup-wizard.js";
import type { ChannelSetupAdapter } from "../channels/plugins/types.adapters.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";

type FacadeModule = {
  ircSetupAdapter: ChannelSetupAdapter;
  ircSetupWizard: ChannelSetupWizard;
  listIrcAccountIds: (cfg: CoreBlowConfig) => string[];
  resolveDefaultIrcAccountId: (cfg: CoreBlowConfig) => string;
  resolveIrcAccount: (params: { cfg: CoreBlowConfig; accountId?: string | null }) => unknown;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "irc",
    artifactBasename: "api.js",
  });
}

export const ircSetupAdapter: FacadeModule["ircSetupAdapter"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().ircSetupAdapter,
);
export const ircSetupWizard: FacadeModule["ircSetupWizard"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().ircSetupWizard,
);
export const listIrcAccountIds: FacadeModule["listIrcAccountIds"] = createLazyFacadeValue(
  loadFacadeModule,
  "listIrcAccountIds",
);
export const resolveDefaultIrcAccountId: FacadeModule["resolveDefaultIrcAccountId"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDefaultIrcAccountId");
export const resolveIrcAccount: FacadeModule["resolveIrcAccount"] = createLazyFacadeValue(
  loadFacadeModule,
  "resolveIrcAccount",
);
