/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { CoreBlowConfig } from "../config/config.js";
import type { DiscordAccountConfig } from "../config/types.discord.js";
import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

export type ResolvedDiscordAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  config: DiscordAccountConfig;
};

type FacadeModule = {
  resolveDiscordAccount: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
  }) => ResolvedDiscordAccount;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "discord",
    artifactBasename: "api.js",
  });
}

export const resolveDiscordAccount: FacadeModule["resolveDiscordAccount"] = createLazyFacadeValue(
  loadFacadeModule,
  "resolveDiscordAccount",
);
