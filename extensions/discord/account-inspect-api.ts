import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: CoreBlowConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
