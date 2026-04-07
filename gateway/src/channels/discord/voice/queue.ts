/**
 * Discord Voice Queue — Manages a queue of audio tracks for playback.
 */
export interface QueueItem { url: string; title: string; requestedBy: string; addedAt: number; }

export class VoiceQueue {
    private items: QueueItem[] = [];
    private currentIndex = -1;
    private loopMode: 'none' | 'single' | 'all' = 'none';

    add(url: string, title: string, requestedBy: string): number {
        this.items.push({ url, title, requestedBy, addedAt: Date.now() });
        return this.items.length;
    }

    next(): QueueItem | null {
        if (this.items.length === 0) return null;
        if (this.loopMode === 'single' && this.currentIndex >= 0) return this.items[this.currentIndex] ?? null;
        this.currentIndex++;
        if (this.currentIndex >= this.items.length) {
            if (this.loopMode === 'all') { this.currentIndex = 0; } else { return null; }
        }
        return this.items[this.currentIndex] ?? null;
    }

    skip(): QueueItem | null { return this.next(); }
    remove(index: number): boolean { if (index < 0 || index >= this.items.length) return false; this.items.splice(index, 1); if (index <= this.currentIndex) this.currentIndex--; return true; }
    clear(): void { this.items = []; this.currentIndex = -1; }
    shuffle(): void { for (let i = this.items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.items[i], this.items[j]] = [this.items[j]!, this.items[i]!]; } }
    setLoop(mode: 'none' | 'single' | 'all'): void { this.loopMode = mode; }
    getQueue(): QueueItem[] { return [...this.items]; }
    getCurrent(): QueueItem | null { return this.currentIndex >= 0 ? this.items[this.currentIndex] ?? null : null; }
    get length(): number { return this.items.length; }
}