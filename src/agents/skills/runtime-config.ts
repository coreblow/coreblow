import { getRuntimeConfigSnapshot, type CoreBlowConfig } from "../../config/config.js";

export function resolveSkillRuntimeConfig(config?: CoreBlowConfig): CoreBlowConfig | undefined {
  return getRuntimeConfigSnapshot() ?? config;
}
