/** CoreBlow — Legacy Config Support */
export function isLegacyConfig(config: Record<string, unknown>): boolean { return config.version === undefined || Number(config.version) < 2; }
export function getLegacyConfigVersion(config: Record<string, unknown>): number { return Number(config.version ?? 0); }
