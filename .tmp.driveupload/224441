/**
 * process/graceful-shutdown.ts
 */
export class GracefulShutdown { private handlers: Array<{name: string; fn: () => Promise<void>}> = []; register(name: string, fn: () => Promise<void>) { this.handlers.push({name, fn}); } async shutdown(timeoutMs = 30000) { const timer = setTimeout(() => process.exit(1), timeoutMs); for (const h of this.handlers) { try { await h.fn(); } catch { /* intentionally ignored */ } } clearTimeout(timer); } install() { const handler = () => this.shutdown().then(() => process.exit(0)); process.on('SIGTERM', handler); process.on('SIGINT', handler); } }
