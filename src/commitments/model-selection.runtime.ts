import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import type { CoreBlowConfig } from "../config/config.js";

export function resolveCommitmentDefaultModelRef(params: {
  cfg: CoreBlowConfig;
  agentId?: string;
}): { provider: string; model: string } {
  return resolveDefaultModelForAgent(params);
}
