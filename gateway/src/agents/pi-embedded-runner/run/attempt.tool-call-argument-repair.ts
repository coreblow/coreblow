/** CoreBlow — Tool Call Argument Repair */ export function repairToolCallArguments(args: string): Record<string, unknown> { try { return JSON.parse(args); } catch { return {}; } }
