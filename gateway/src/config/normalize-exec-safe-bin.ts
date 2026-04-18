/** CoreBlow — Normalize Exec Safe Bin */ export function normalizeExecSafeBin(bin: string): string { return bin.trim().replace(/\\/g, "/"); }
