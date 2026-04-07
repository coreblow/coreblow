/**
 * logging/log-levels.ts
 */
export const LOG_LEVELS = {trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5} as const; export type LogLevel = keyof typeof LOG_LEVELS; export function shouldLog(messageLevel: LogLevel, configLevel: LogLevel): boolean { return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel]; }
