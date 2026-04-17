/** Process management utilities. */
export function killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean { try { process.kill(pid, signal); return true; } catch { return false; } }
export function isProcessAlive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch { return false; } }
