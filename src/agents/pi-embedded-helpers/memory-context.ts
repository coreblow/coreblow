/** CoreBlow — PI Memory Context */ export function buildMemoryContext(memories: Array<{ content: string }>): string { return memories.map((m) => m.content).join("\n"); }
