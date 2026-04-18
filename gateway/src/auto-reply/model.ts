/** CoreBlow — Auto-Reply Model */ export function resolveReplyModel(config: Record<string, unknown>): string { return String(config.model ?? "claude-sonnet-4-20250514"); }
