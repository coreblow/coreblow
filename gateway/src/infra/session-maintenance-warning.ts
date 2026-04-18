/** CoreBlow — Session Maintenance Warning */
export interface MaintenanceWarning { message: string; scheduledAt: number; durationMs: number; }
export function isMaintenanceActive(warning: MaintenanceWarning): boolean { const now = Date.now(); return now >= warning.scheduledAt && now < warning.scheduledAt + warning.durationMs; }
export function formatMaintenanceWarning(w: MaintenanceWarning): string { return "[MAINTENANCE] " + w.message + " (scheduled: " + new Date(w.scheduledAt).toISOString() + ")"; }
