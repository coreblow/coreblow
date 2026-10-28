import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { CoreBlowConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): CoreBlowConfig | null {
  return null;
}
