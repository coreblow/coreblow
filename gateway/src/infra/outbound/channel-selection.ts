/** CoreBlow — Channel Selection */
export type SelectionStrategy = "first-available" | "round-robin" | "priority";
export function selectChannel<T extends { available: boolean; priority: number }>(channels: T[], strategy: SelectionStrategy = "priority"): T | null { const available = channels.filter((c) => c.available); if (available.length === 0) return null; if (strategy === "priority") return available.sort((a, b) => b.priority - a.priority)[0]; return available[0]; }
