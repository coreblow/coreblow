/**
 * extensions/session-manager.ts
 * Session manager extension runtime.
 * Ported from CoreBlow reference src/agents/pi-extensions/session-manager-runtime-registry.ts.
 */

export interface SessionManagerExtension {
    id: string;
    onSessionCreate?: (sessionId: string, metadata: Record<string, unknown>) => Promise<void>;
    onSessionResume?: (sessionId: string) => Promise<void>;
    onSessionEnd?: (sessionId: string) => Promise<void>;
    onSessionExport?: (sessionId: string) => Promise<Record<string, unknown>>;
    onSessionImport?: (sessionId: string, data: Record<string, unknown>) => Promise<void>;
}

export class SessionManagerRegistry {
    private managers = new Map<string, SessionManagerExtension>();

    register(manager: SessionManagerExtension): void {
        this.managers.set(manager.id, manager);
    }

    unregister(id: string): boolean {
        return this.managers.delete(id);
    }

    get(id: string): SessionManagerExtension | undefined {
        return this.managers.get(id);
    }

    list(): SessionManagerExtension[] {
        return [...this.managers.values()];
    }

    async notifyCreate(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
        for (const manager of this.managers.values()) {
            try { await manager.onSessionCreate?.(sessionId, metadata); }
            catch { /* extension error is non-fatal */ }
        }
    }

    async notifyResume(sessionId: string): Promise<void> {
        for (const manager of this.managers.values()) {
            try { await manager.onSessionResume?.(sessionId); }
            catch { /* non-fatal */ }
        }
    }

    async notifyEnd(sessionId: string): Promise<void> {
        for (const manager of this.managers.values()) {
            try { await manager.onSessionEnd?.(sessionId); }
            catch { /* non-fatal */ }
        }
    }

    async exportAll(sessionId: string): Promise<Record<string, Record<string, unknown>>> {
        const result: Record<string, Record<string, unknown>> = {};
        for (const [id, manager] of this.managers) {
            try {
                const data = await manager.onSessionExport?.(sessionId);
                if (data) result[id] = data;
            } catch { /* non-fatal */ }
        }
        return result;
    }

    async importAll(sessionId: string, data: Record<string, Record<string, unknown>>): Promise<void> {
        for (const [id, extData] of Object.entries(data)) {
            const manager = this.managers.get(id);
            if (manager) {
                try { await manager.onSessionImport?.(sessionId, extData); }
                catch { /* non-fatal */ }
            }
        }
    }
}
