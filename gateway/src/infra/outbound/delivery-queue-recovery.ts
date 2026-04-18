/** CoreBlow — Delivery Queue Recovery */
export interface RecoveryResult { recovered: number; failed: number; }
export function createRecoveryResult(): RecoveryResult { return { recovered: 0, failed: 0 }; }
