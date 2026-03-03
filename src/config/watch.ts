/**
 * config/watch.ts
 */
import fs from 'node:fs'; export function watchConfig(path: string, onChange: (config: unknown) => void) { let lastContent = ''; return fs.watch(path, () => { try { const content = fs.readFileSync(path, 'utf-8'); if (content !== lastContent) { lastContent = content; onChange(JSON.parse(content)); } } catch { /* intentionally ignored */ } }); }
