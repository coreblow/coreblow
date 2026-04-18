/** CoreBlow — PI Context Injection */ export function injectContext(systemPrompt: string, context: string): string { return systemPrompt + "\n\n<context>\n" + context + "\n</context>"; }
