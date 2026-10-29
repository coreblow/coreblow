import type { CoreBlowConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: CoreBlowConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
