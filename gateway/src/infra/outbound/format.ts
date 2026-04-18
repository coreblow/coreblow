/** CoreBlow — Outbound Format */
export function formatOutboundText(text: string, maxLength = 4000): string { if (text.length <= maxLength) return text; return text.slice(0, maxLength - 3) + "..."; }
export function stripMarkdown(text: string): string { return text.replace(/[*_~`#\[\]]/g, ""); }
