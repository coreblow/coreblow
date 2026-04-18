/** CoreBlow — Synthetic Models */ export const SYNTHETIC_MODELS = ["echo", "mock", "test"]; export function isSyntheticModel(m: string): boolean { return SYNTHETIC_MODELS.includes(m); }
