import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
} from "../config/runtime-snapshot.js";
import type { CoreBlowConfig } from "../config/types.js";

export function resolvePluginActivationSourceConfig(params: {
  config?: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
}): CoreBlowConfig {
  if (params.activationSourceConfig !== undefined) {
    return params.activationSourceConfig;
  }
  const sourceSnapshot = getRuntimeConfigSourceSnapshot();
  if (sourceSnapshot && params.config === getRuntimeConfigSnapshot()) {
    return sourceSnapshot;
  }
  return params.config ?? {};
}
