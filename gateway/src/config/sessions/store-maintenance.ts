/** CoreBlow — Session Store Maintenance */
export interface MaintenanceResult { expired: number; archived: number; deleted: number; }
export function createMaintenanceResult(): MaintenanceResult { return { expired: 0, archived: 0, deleted: 0 }; }
