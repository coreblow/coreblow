/**
 * link-understanding/og-parser.ts
 */
export function parseOpenGraph(html: string): Record<string, string> { const og: Record<string, string> = {}; const regex = /<meta\s+property=["']og:([^"']+)["']\s+content=["']([^"']+)["']/gi; let m; while ((m = regex.exec(html)) !== null) og[m[1]] = m[2]; return og; }
