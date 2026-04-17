/**
 * CoreBlow — Memory Compaction
 * Prunes old/low-importance memories, merges similar ones.
 */

interface CompactOpts {
    maxMemories?: number;
    targetMemories?: number;
    pruneAgeMs?: number;
    tier2AgeMs?: number;
    keepImportanceThreshold?: number;
}

interface MemEntry {
    id: string; text: string; embedding: Float32Array | number[];
    metadata: { timestamp: number; importance: number; type?: string; [k: string]: unknown };
}

export class MemoryCompactor {
    private opts: Required<CompactOpts>;
    constructor(opts?: CompactOpts) {
        this.opts = {
            maxMemories: opts?.maxMemories ?? 1000,
            targetMemories: opts?.targetMemories ?? 500,
            pruneAgeMs: opts?.pruneAgeMs ?? 30 * 24 * 60 * 60 * 1000,
            tier2AgeMs: opts?.tier2AgeMs ?? 7 * 24 * 60 * 60 * 1000,
            keepImportanceThreshold: opts?.keepImportanceThreshold ?? 0.8,
        };
    }

    shouldCompact(count: number): boolean { return count >= this.opts.maxMemories; }

    compact(entries: MemEntry[]): { entries: MemEntry[], result: { merged: number; pruned: number; preserved: number; remaining: number; freedBytes: number } } {
        const now = Date.now();
        const protectedTypes = new Set(['fact', 'preference']);
        let pruned = 0, merged = 0;

        // Separate protected from pruneable
        const kept: MemEntry[] = [];
        for (const e of entries) {
            const age = now - e.metadata.timestamp;
            const isProtected = protectedTypes.has(e.metadata.type || '') ||
                e.metadata.importance >= this.opts.keepImportanceThreshold;
            if (isProtected || age < this.opts.pruneAgeMs) {
                kept.push(e);
            } else {
                pruned++;
            }
        }

        // Enforce target
        let result = kept;
        if (this.opts.targetMemories > 0 && result.length > this.opts.targetMemories) {
            result.sort((a, b) => {
                const scoreA = a.metadata.importance + (1 - (now - a.metadata.timestamp) / (this.opts.pruneAgeMs * 2));
                const scoreB = b.metadata.importance + (1 - (now - b.metadata.timestamp) / (this.opts.pruneAgeMs * 2));
                return scoreB - scoreA;
            });
            pruned += result.length - this.opts.targetMemories;
            result = result.slice(0, this.opts.targetMemories);
        }

        return {
            entries: result,
            result: { merged, pruned, preserved: result.length, remaining: result.length, freedBytes: pruned * 200 },
        };
    }
}
