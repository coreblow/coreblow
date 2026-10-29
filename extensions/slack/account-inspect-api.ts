import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: CoreBlowConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
