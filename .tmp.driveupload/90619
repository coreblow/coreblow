/**
 * infra/fs/glob.ts
 */
import fs from 'node:fs'; import path from 'node:path'; export function globSync(dir: string, pattern: string): string[] { const results: string[] = []; const ext = pattern.replace('*', ''); const walk = (d: string) => { try { for (const entry of fs.readdirSync(d, {withFileTypes: true})) { const full = path.join(d, entry.name); if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full); else if (entry.isFile() && entry.name.endsWith(ext)) results.push(full); } } catch { /* intentionally ignored */ } }; walk(dir); return results; }
