/** CoreBlow — PI Message Action Discovery */ export function discoverActions(text: string): string[] { const matches = text.match(/\/\w+/g); return matches ?? []; }
