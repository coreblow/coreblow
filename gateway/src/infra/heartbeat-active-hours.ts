/** CoreBlow — Heartbeat Active Hours */
export interface ActiveHoursConfig { startHour: number; endHour: number; timezone?: string; daysOfWeek?: number[]; }
export function isWithinActiveHours(config: ActiveHoursConfig, now = new Date()): boolean {
  const hour = now.getHours();
  if (config.daysOfWeek && !config.daysOfWeek.includes(now.getDay())) return false;
  return config.startHour <= config.endHour ? hour >= config.startHour && hour < config.endHour : hour >= config.startHour || hour < config.endHour;
}
