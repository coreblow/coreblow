/** agents/identity-file.ts — Identity file loading. */
import fs from 'node:fs';
import path from 'node:path';
export function loadIdentityFile(dir: string): Record<string, unknown> | null {
    const p = path.join(dir, '.coreblow', 'identity.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
