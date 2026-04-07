/**
 * agents/model-fallback.ts
 * Model fallback chain with rate limit detection.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('agent:model-fallback');

export interface FallbackEntry { model: string; provider: string; priority: number }
export interface FallbackChain { entries: FallbackEntry[]; currentIndex: number }

export function createFallbackChain(entries: FallbackEntry[]): FallbackChain {
    return { entries: entries.sort((a, b) => b.priority - a.priority), currentIndex: 0 };
}

export function getCurrentModel(chain: FallbackChain): FallbackEntry | null { return chain.entries[chain.currentIndex] ?? null; }

export function advanceFallback(chain: FallbackChain, reason: string): FallbackEntry | null {
    chain.currentIndex++;
    const next = chain.entries[chain.currentIndex];
    if (next) log.warn({ from: chain.entries[chain.currentIndex - 1]?.model, to: next.model, reason }, 'Falling back to next model');
    return next ?? null;
}

export function isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes('rate limit') || msg.includes('429') || msg.includes('quota') || msg.includes('too many requests');
    }
    return false;
}

export function resetFallbackChain(chain: FallbackChain): void { chain.currentIndex = 0; }
