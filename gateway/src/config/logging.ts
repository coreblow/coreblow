/** CoreBlow — Config Logging */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env): LogLevel { const l = env.COREBLOW_LOG_LEVEL?.trim()?.toLowerCase(); if (l === "debug" || l === "info" || l === "warn" || l === "error" || l === "silent") return l; return "info"; }
export function isLogLevelEnabled(current: LogLevel, target: LogLevel): boolean { const order: LogLevel[] = ["debug", "info", "warn", "error", "silent"]; return order.indexOf(current) <= order.indexOf(target); }
