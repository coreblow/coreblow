export const MEMORY_LANCEDB_COMMAND_ALIASES = ["ltm"] as const;

export const memoryLancedbCliMetadata = {
  commandAliases: [...MEMORY_LANCEDB_COMMAND_ALIASES],
} as const;
