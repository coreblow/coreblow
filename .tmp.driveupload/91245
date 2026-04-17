/** Live model switching. */
export interface ModelSwitch { from: string; to: string; reason?: string; timestamp: number; }
const switches: ModelSwitch[] = [];
export function recordSwitch(from: string, to: string, reason?: string): void { switches.push({ from, to, reason, timestamp: Date.now() }); }
export function getSwitchHistory(): readonly ModelSwitch[] { return switches; }
export function clearSwitchHistory(): void { switches.length = 0; }
