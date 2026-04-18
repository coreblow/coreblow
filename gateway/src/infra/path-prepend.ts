/** CoreBlow — Path Prepend */
export function prependToPath(dir: string, existingPath?: string): string { const current = existingPath ?? process.env.PATH ?? ""; const sep = process.platform === "win32" ? ";" : ":"; if (current.split(sep).includes(dir)) return current; return dir + sep + current; }
