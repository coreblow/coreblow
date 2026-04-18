/** CoreBlow — Plugin Helpers */ export function isPluginEnabled(config: Record<string, unknown>): boolean { return config.enabled !== false; }
