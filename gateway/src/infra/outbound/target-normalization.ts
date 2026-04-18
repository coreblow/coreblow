/** CoreBlow — Target Normalization */
export function normalizeTargetId(targetId: string): string { return targetId.trim().toLowerCase().replace(/\s+/g, "-"); }
