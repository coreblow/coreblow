/** CoreBlow — Config Environment Variables */
export const CONFIG_ENV_VARS = {
  COREBLOW_HOME: { description: "CoreBlow home directory", default: "~/.coreblow" },
  COREBLOW_CONFIG_PATH: { description: "Config file path", default: "~/.coreblow/coreblow.json" },
  COREBLOW_STATE_DIR: { description: "State directory", default: "~/.coreblow" },
  COREBLOW_PROFILE: { description: "Active profile name", default: "default" },
  COREBLOW_LOG_LEVEL: { description: "Log level", default: "info" },
  COREBLOW_PORT: { description: "Gateway port", default: "3000" },
  COREBLOW_DEBUG: { description: "Debug mode", default: "false" },
} as const;
export function getConfigEnvVar(name: keyof typeof CONFIG_ENV_VARS): string { return process.env[name]?.trim() ?? CONFIG_ENV_VARS[name].default; }
