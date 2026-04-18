/** CoreBlow — PI System Prompt Builder */ export function buildSystemPrompt(parts: string[]): string { return parts.filter(Boolean).join("\n\n"); }
