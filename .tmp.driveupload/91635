/** Session file repair — fix corrupted session files. */
export function repairJsonl(content: string): string[] { return content.split('\n').filter((line) => { try { JSON.parse(line); return true; } catch { return false; } }); }
