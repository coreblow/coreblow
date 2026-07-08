export const OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isOwnerOnlyCoreToolName(toolName: string): boolean {
  return OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
