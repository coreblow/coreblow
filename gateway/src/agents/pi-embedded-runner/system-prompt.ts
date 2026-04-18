/** CoreBlow — PI System Prompt */ export function buildPiSystemPrompt(parts: string[]): string { return parts.filter(Boolean).join("\n\n"); }
