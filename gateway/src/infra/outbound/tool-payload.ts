/** CoreBlow — Tool Payload */
export interface ToolPayload { toolName: string; input: Record<string, unknown>; output?: unknown; error?: string; durationMs?: number; }
export function formatToolPayload(p: ToolPayload): string { return "[" + p.toolName + "] " + (p.error ? "ERROR: " + p.error : "OK") + (p.durationMs ? " (" + p.durationMs + "ms)" : ""); }
