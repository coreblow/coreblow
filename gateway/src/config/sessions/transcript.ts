/** CoreBlow — Session Transcript */
export interface TranscriptEntry { role: "user" | "assistant" | "system" | "tool"; content: string; timestamp: number; model?: string; tokenCount?: number; }
export function formatTranscriptEntry(e: TranscriptEntry): string { return "[" + e.role + "] " + e.content.slice(0, 100) + (e.content.length > 100 ? "..." : ""); }
