/** CoreBlow — PI Tool Split */ export function splitToolCalls(content: string): string[] { return content.split("\n").filter((l) => l.startsWith("tool:")); }
