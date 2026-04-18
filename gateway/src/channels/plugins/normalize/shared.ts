/** CoreBlow — Normalize Shared */ export function normalizeText(text: string): string { return text.replace(/\r\n/g, "\n").trim(); }
