/** CoreBlow — Compaction Safeguard */ export function validateCompaction(before: number, after: number): boolean { return after < before && after > 0; }
