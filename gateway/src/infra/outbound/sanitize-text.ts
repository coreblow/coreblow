/** CoreBlow — Sanitize Text */
export function sanitizeOutboundText(text: string): string { return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim(); }
export function truncateText(text: string, maxLength: number): string { if (text.length <= maxLength) return text; return text.slice(0, maxLength - 1) + "…"; }
