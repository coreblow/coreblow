import type { CoreBlowConfig } from "../../config/config.js";
import type { HookClientIpConfig } from "./hooks-request-handler.js";

export function resolveHookClientIpConfig(cfg: CoreBlowConfig): HookClientIpConfig {
  return {
    trustedProxies: cfg.gateway?.trustedProxies,
    allowRealIpFallback: cfg.gateway?.allowRealIpFallback === true,
  };
}
