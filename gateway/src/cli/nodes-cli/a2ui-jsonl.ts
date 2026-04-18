/** CoreBlow — Nodes A2UI JSONL */ export function parseA2uiJsonl(line: string): Record<string, unknown> | null { try { return JSON.parse(line); } catch { return null; } }
