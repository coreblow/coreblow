/** CoreBlow — Session Disk Budget */
export interface DiskBudget { maxSessionSizeBytes: number; maxTotalSizeBytes: number; warnThresholdPercent: number; }
export const DEFAULT_DISK_BUDGET: DiskBudget = { maxSessionSizeBytes: 50 * 1024 * 1024, maxTotalSizeBytes: 500 * 1024 * 1024, warnThresholdPercent: 80 };
export function isDiskBudgetExceeded(currentBytes: number, budget: DiskBudget): boolean { return currentBytes > budget.maxTotalSizeBytes; }
