/**
 * CoreBlow — Subagent Announce Queue (CoreBlow Parity)
 *
 * Buffered announce delivery with debounce, cap/drop policy,
 * collect mode, summary, and exponential backoff on drain fail.
 */

import type { DeliveryContext } from './subagent-registry-types.js';

// ─── Types ──────────────────────────────────────────────────────

export type QueueMode = 'followup' | 'collect' | 'steer' | 'steer-backlog' | 'interrupt';
export type QueueDropPolicy = 'summarize' | 'new' | 'old';

export type AnnounceQueueItem = {
    announceId?: string;
    prompt: string;
    summaryLine?: string;
    internalEvents?: Array<{ type: string; [key: string]: unknown }>;
    enqueuedAt: number;
    sessionKey: string;
    origin?: DeliveryContext;
    originKey?: string;
    sourceSessionKey?: string;
    sourceChannel?: string;
    sourceTool?: string;
};

export type AnnounceQueueSettings = {
    mode: QueueMode;
    debounceMs?: number;
    cap?: number;
    dropPolicy?: QueueDropPolicy;
};

type AnnounceQueueState = {
    items: AnnounceQueueItem[];
    draining: boolean;
    lastEnqueuedAt: number;
    mode: QueueMode;
    debounceMs: number;
    cap: number;
    dropPolicy: QueueDropPolicy;
    droppedCount: number;
    summaryLines: string[];
    send: (item: AnnounceQueueItem) => Promise<void>;
    consecutiveFailures: number;
};

// ─── Singleton Queue Map ────────────────────────────────────────

const ANNOUNCE_QUEUES = new Map<string, AnnounceQueueState>();

export function resetAnnounceQueuesForTests(): void {
    for (const queue of ANNOUNCE_QUEUES.values()) {
        queue.items.length = 0;
        queue.summaryLines.length = 0;
        queue.droppedCount = 0;
        queue.lastEnqueuedAt = 0;
    }
    ANNOUNCE_QUEUES.clear();
}

// ─── Queue Management ───────────────────────────────────────────

function getAnnounceQueue(
    key: string,
    settings: AnnounceQueueSettings,
    send: (item: AnnounceQueueItem) => Promise<void>,
): AnnounceQueueState {
    const existing = ANNOUNCE_QUEUES.get(key);
    if (existing) {
        existing.mode = settings.mode;
        existing.send = send;
        if (typeof settings.debounceMs === 'number') {
            existing.debounceMs = Math.max(0, settings.debounceMs);
        }
        if (typeof settings.cap === 'number' && settings.cap > 0) {
            existing.cap = Math.floor(settings.cap);
        }
        if (settings.dropPolicy) existing.dropPolicy = settings.dropPolicy;
        return existing;
    }
    const created: AnnounceQueueState = {
        items: [],
        draining: false,
        lastEnqueuedAt: 0,
        mode: settings.mode,
        debounceMs: typeof settings.debounceMs === 'number' ? Math.max(0, settings.debounceMs) : 1000,
        cap: typeof settings.cap === 'number' && settings.cap > 0 ? Math.floor(settings.cap) : 20,
        dropPolicy: settings.dropPolicy ?? 'summarize',
        droppedCount: 0,
        summaryLines: [],
        send,
        consecutiveFailures: 0,
    };
    ANNOUNCE_QUEUES.set(key, created);
    return created;
}

// ─── Drop Policy ────────────────────────────────────────────────

function applyDropPolicy(queue: AnnounceQueueState, item: AnnounceQueueItem): boolean {
    if (queue.items.length < queue.cap) return true;

    if (queue.dropPolicy === 'new') {
        queue.droppedCount++;
        const summary = item.summaryLine?.trim() || item.prompt.trim().slice(0, 100);
        queue.summaryLines.push(summary);
        return false;
    }

    if (queue.dropPolicy === 'old') {
        const removed = queue.items.shift();
        if (removed) {
            queue.droppedCount++;
            const summary = removed.summaryLine?.trim() || removed.prompt.trim().slice(0, 100);
            queue.summaryLines.push(summary);
        }
        return true;
    }

    // summarize: drop oldest and summarize
    const removed = queue.items.shift();
    if (removed) {
        queue.droppedCount++;
        const summary = removed.summaryLine?.trim() || removed.prompt.trim().slice(0, 100);
        queue.summaryLines.push(summary);
    }
    return true;
}

// ─── Drain ──────────────────────────────────────────────────────

function scheduleDrain(key: string): void {
    const queue = ANNOUNCE_QUEUES.get(key);
    if (!queue || queue.draining) return;
    if (queue.items.length === 0 && queue.droppedCount === 0) return;

    queue.draining = true;
    void (async () => {
        try {
            while (queue.items.length > 0 || queue.droppedCount > 0) {
                // Debounce wait
                const elapsed = Date.now() - queue.lastEnqueuedAt;
                if (elapsed < queue.debounceMs) {
                    await new Promise(resolve =>
                        setTimeout(resolve, queue.debounceMs - elapsed),
                    );
                }

                // Build summary prompt if drops occurred
                if (queue.droppedCount > 0 && queue.summaryLines.length > 0) {
                    const summaryPrompt = [
                        `[${queue.droppedCount} announce(s) were summarized]`,
                        ...queue.summaryLines.map((s, i) => `- ${i + 1}. ${s}`),
                    ].join('\n');
                    const nextItem = queue.items.shift();
                    if (nextItem) {
                        await queue.send({ ...nextItem, prompt: summaryPrompt });
                    }
                    queue.droppedCount = 0;
                    queue.summaryLines.length = 0;
                    continue;
                }

                // Collect mode: batch all items
                if (queue.mode === 'collect' && queue.items.length > 1) {
                    const items = queue.items.splice(0);
                    const prompt = [
                        '[Queued announce messages while agent was busy]',
                        ...items.map((item, i) => `---\nQueued #${i + 1}\n${item.prompt}`),
                    ].join('\n');
                    const events = items.flatMap(item => item.internalEvents ?? []);
                    const last = items[items.length - 1]!;
                    await queue.send({
                        ...last,
                        prompt,
                        internalEvents: events.length > 0 ? events : last.internalEvents,
                    });
                    continue;
                }

                // Drain next item
                const item = queue.items.shift();
                if (!item) break;
                await queue.send(item);
            }
            queue.consecutiveFailures = 0;
        } catch {
            queue.consecutiveFailures++;
            const backoffMs = Math.min(1000 * Math.pow(2, queue.consecutiveFailures), 60_000);
            queue.lastEnqueuedAt = Date.now() + backoffMs - queue.debounceMs;
        } finally {
            queue.draining = false;
            if (queue.items.length === 0 && queue.droppedCount === 0) {
                ANNOUNCE_QUEUES.delete(key);
            } else {
                scheduleDrain(key);
            }
        }
    })();
}

// ─── Enqueue ────────────────────────────────────────────────────

export function enqueueAnnounce(params: {
    key: string;
    item: AnnounceQueueItem;
    settings: AnnounceQueueSettings;
    send: (item: AnnounceQueueItem) => Promise<void>;
}): boolean {
    const queue = getAnnounceQueue(params.key, params.settings, params.send);
    queue.lastEnqueuedAt = Math.max(queue.lastEnqueuedAt, Date.now());

    const shouldEnqueue = applyDropPolicy(queue, params.item);
    if (!shouldEnqueue) {
        if (queue.dropPolicy === 'new') scheduleDrain(params.key);
        return false;
    }

    queue.items.push(params.item);
    scheduleDrain(params.key);
    return true;
}

// ─── Info ───────────────────────────────────────────────────────

export function getQueueSize(key: string): number {
    return ANNOUNCE_QUEUES.get(key)?.items.length ?? 0;
}

export function isQueueDraining(key: string): boolean {
    return ANNOUNCE_QUEUES.get(key)?.draining ?? false;
}
