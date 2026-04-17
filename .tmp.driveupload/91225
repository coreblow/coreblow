/** PTY Device Status Report handling. */
export function parseDsr(data: string): { row: number; col: number } | null { const m = data.match(/\x1b\[(\d+);(\d+)R/); return m ? { row: parseInt(m[1]), col: parseInt(m[2]) } : null; }
