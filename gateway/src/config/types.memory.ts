/** CoreBlow — Types: Memory */ export interface MemoryConfig { enabled: boolean; maxEntries: number; persistPath?: string; provider: "local" | "redis" | "sqlite"; }
