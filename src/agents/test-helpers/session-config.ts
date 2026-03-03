import type { CoreBlowConfig } from "../../config/config.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<CoreBlowConfig["session"]>> = {},
): NonNullable<CoreBlowConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
