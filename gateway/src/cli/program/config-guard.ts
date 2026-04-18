/** CoreBlow — Config Guard */ export function ensureConfigExists(configPath: string): boolean { try { require("node:fs").accessSync(configPath); return true; } catch { return false; } }
