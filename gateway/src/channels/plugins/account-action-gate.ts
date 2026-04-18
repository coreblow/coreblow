/** CoreBlow — Account Action Gate */ export function canPerformAction(action: string, permissions: string[]): boolean { return permissions.includes(action) || permissions.includes("*"); }
