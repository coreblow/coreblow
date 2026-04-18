/** CoreBlow — Message Action Normalization */
export function normalizeActionType(type: string): string { return type.toLowerCase().replace(/[^a-z0-9_]/g, "_"); }
