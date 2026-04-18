/** CoreBlow — Agent Interject */ export function shouldInterject(input: string): boolean { return input.startsWith("/") || input.startsWith("!"); }
