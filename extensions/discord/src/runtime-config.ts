import { getRuntimeConfig } from "coreblow/plugin-sdk/runtime-config-snapshot";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";

export function selectDiscordRuntimeConfig(inputConfig: CoreBlowConfig): CoreBlowConfig {
  return getRuntimeConfig() ?? inputConfig;
}
