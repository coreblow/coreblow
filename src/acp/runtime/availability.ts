import type { CoreBlowConfig } from "../../config/config.js";
import { isAcpEnabledByPolicy } from "../policy.js";
import { getAcpRuntimeBackend } from "./registry.js";

export function isAcpRuntimeSpawnAvailable(params: {
  config?: CoreBlowConfig;
  sandboxed?: boolean;
  backendId?: string;
}): boolean {
  if (params.sandboxed || (params.config && !isAcpEnabledByPolicy(params.config))) {
    return false;
  }

  const backend = getAcpRuntimeBackend(params.backendId ?? params.config?.acp?.backend);
  if (!backend) {
    return false;
  }
  try {
    return backend.healthy?.() ?? true;
  } catch {
    return false;
  }
}
