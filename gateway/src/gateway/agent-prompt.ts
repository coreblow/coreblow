/** CoreBlow — Agent Prompt Assembly */ export function assemblePrompt(systemPrompt: string, contextParts: string[]): string { return [systemPrompt, ...contextParts].filter(Boolean).join("\n\n"); }
