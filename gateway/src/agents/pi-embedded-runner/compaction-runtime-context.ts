/** CoreBlow — Compaction Runtime Context */ export interface CompactionContext { maxTokens: number; currentTokens: number; strategy: "truncate" | "summarize"; }
