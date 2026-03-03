/**
 * Discord Thread Manager — Manages thread lifecycle and metadata.
 */
export interface ThreadInfo { id: string; name: string; parentId: string; createdAt: number; archived: boolean; locked: boolean; messageCount: number; }

export class ThreadManager {
    private threads = new Map<string, ThreadInfo>();

    track(id: string, name: string, parentId: string): void {
        this.threads.set(id, { id, name, parentId, createdAt: Date.now(), archived: false, locked: false, messageCount: 0 });
    }

    archive(id: string): boolean { const t = this.threads.get(id); if (!t) return false; t.archived = true; return true; }
    unarchive(id: string): boolean { const t = this.threads.get(id); if (!t) return false; t.archived = false; return true; }
    lock(id: string): boolean { const t = this.threads.get(id); if (!t) return false; t.locked = true; return true; }
    incrementMessages(id: string): void { const t = this.threads.get(id); if (t) t.messageCount++; }
    get(id: string): ThreadInfo | undefined { return this.threads.get(id); }
    listByParent(parentId: string): ThreadInfo[] { return [...this.threads.values()].filter((t) => t.parentId === parentId); }
    listActive(): ThreadInfo[] { return [...this.threads.values()].filter((t) => !t.archived); }
    get count(): number { return this.threads.size; }
}
