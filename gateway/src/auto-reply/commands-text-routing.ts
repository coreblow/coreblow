/** CoreBlow — Commands Text Routing */ export function routeTextToCommand(text: string): string | null { if (text.startsWith("/")) return text.split(/\s/)[0].slice(1); return null; }
