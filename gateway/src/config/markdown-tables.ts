/** CoreBlow — Config Markdown Tables */
export function configToMarkdownTable(entries: Array<{ key: string; value: string; description?: string }>): string { const header = "| Key | Value | Description |\n|-----|-------|-------------|\n"; const rows = entries.map((e) => "| " + e.key + " | " + e.value + " | " + (e.description ?? "") + " |").join("\n"); return header + rows; }
