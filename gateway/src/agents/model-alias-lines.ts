/** Model alias line parsing. */
export function parseModelAlias(line: string): { alias: string; target: string } | null { const m = line.match(/^([\w-]+)\s*=\s*([\w\/-]+)/); return m ? { alias: m[1], target: m[2] } : null; }
export function formatModelAlias(alias: string, target: string): string { return `${alias} = ${target}`; }
