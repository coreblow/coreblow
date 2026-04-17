import type { ContextEntry } from "./types.js";
export function defaultSummarizer(entries: ContextEntry[]): string { return entries.map(e => `[${e.role}] ${e.content}`).join("\n"); }
export function createSummaryEntry(summary: string, tokens: number): ContextEntry { return { role: "assistant", content: summary, timestamp: Date.now(), tokens }; }
export function partitionForSummary(entries: ContextEntry[], maxTokens: number): { keep: ContextEntry[]; summarize: ContextEntry[] } { let total = 0; const keep: ContextEntry[] = []; const summarize: ContextEntry[] = []; for (const e of [...entries].reverse()) { total += e.tokens; if (total <= maxTokens) keep.unshift(e); else summarize.unshift(e); } return { keep, summarize }; }
