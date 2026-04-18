/** CoreBlow — Config Version */ export const CONFIG_VERSION = 2; export function isCurrentVersion(version: unknown): boolean { return Number(version) === CONFIG_VERSION; }
