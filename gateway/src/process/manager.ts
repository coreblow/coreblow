/**
 * process/manager.ts
 */
export class ProcessManager { private procs = new Map<string, {pid: number; status: string}>(); register(name: string, pid: number) { this.procs.set(name, {pid, status: 'running'}); } stop(name: string) { const p = this.procs.get(name); if (p) { try { process.kill(p.pid, 'SIGTERM'); } catch { /* intentionally ignored */ } p.status = 'stopped'; } } getAll() { return Object.fromEntries(this.procs); } }
