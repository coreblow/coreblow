/**
 * gateway/shutdown.ts
 */
export class GracefulShutdown { private handlers: Array<() => Promise<void>> = []; private shuttingDown = false; onShutdown(handler: () => Promise<void>) { this.handlers.push(handler); } async shutdown(signal?: string): Promise<void> { if (this.shuttingDown) return; this.shuttingDown = true; for (const h of this.handlers) { try { await h(); } catch { /* intentionally ignored */ } } process.exit(0); } isShuttingDown(): boolean { return this.shuttingDown; } }
