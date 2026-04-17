/**
 * auto-reply/reply/reply-dedup.ts
 * Deduplicate identical or near-identical replies.
 * Follows CoreBlow's reply-payloads-dedupe.ts pattern.
 */

import { createHash } from 'node:crypto';

export interface DeduplicatedReply {
    content: string;
    isDuplicate: boolean;
    originalHash?: string;
}

/** Recent reply cache for deduplication. */
const replyCache = new Map<string, { content: string; timestamp: number }>();
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 300_000; // 5 minutes

/** Hash reply content for comparison. */
function hashContent(content: string): string {
    return createHash('sha256').update(content.trim().toLowerCase()).digest('hex').slice(0, 16);
}

/** Check if a reply is a duplicate of a recent reply in the same session. */
export function deduplicateReply(sessionId: string, content: string): DeduplicatedReply {
    const hash = hashContent(content);
    const cacheKey = `${sessionId}:${hash}`;

    const existing = replyCache.get(cacheKey);
    if (existing && Date.now() - existing.timestamp < CACHE_TTL_MS) {
        return { content, isDuplicate: true, originalHash: hash };
    }

    // Store in cache
    replyCache.set(cacheKey, { content, timestamp: Date.now() });

    // Evict old entries
    if (replyCache.size > MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [key, val] of replyCache) {
            if (now - val.timestamp > CACHE_TTL_MS) replyCache.delete(key);
        }
    }

    return { content, isDuplicate: false };
}

/** Fuzzy dedup — detect near-identical replies (>90% similar). */
export function isFuzzyDuplicate(a: string, b: string, threshold = 0.9): boolean {
    if (a === b) return true;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return true;
    if (shorter.length / longer.length < threshold) return false;

    // Simple character overlap ratio
    const shorterChars = new Set(shorter.toLowerCase().split(''));
    const longerChars = new Set(longer.toLowerCase().split(''));
    let overlap = 0;
    for (const c of shorterChars) {
        if (longerChars.has(c)) overlap++;
    }
    return overlap / longerChars.size >= threshold;
}

/** Clear the dedup cache. */
export function clearDedupCache(): void { replyCache.clear(); }
