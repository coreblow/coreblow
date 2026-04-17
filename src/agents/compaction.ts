// @ts-nocheck
/**
 * agents/compaction.ts
 * Conversation compaction — summarize and prune history to fit context windows.
 * Ported from CoreBlow reference src/agents/compaction.ts (529 LOC).
 */

export const BASE_CHUNK_RATIO = 0.4;
export const MIN_CHUNK_RATIO = 0.15;
export const SAFETY_MARGIN = 1.2;
export const SUMMARIZATION_OVERHEAD_TOKENS = 4096;
const DEFAULT_SUMMARY_FALLBACK = 'No prior history.';
const DEFAULT_PARTS = 2;

export type IdentifierPolicy = 'strict' | 'custom' | 'off';

export interface CompactionMessage {
    role: string;
    content: string;
    timestamp?: number;
    toolUseId?: string;
}

export interface CompactionSummarizationInstructions {
    identifierPolicy?: IdentifierPolicy;
    identifierInstructions?: string;
}

const IDENTIFIER_PRESERVATION =
    'Preserve all opaque identifiers exactly as written (no shortening or reconstruction), ' +
    'including UUIDs, hashes, IDs, tokens, API keys, hostnames, IPs, ports, URLs, and file names.';

const MERGE_INSTRUCTIONS = [
    'Merge these partial summaries into a single cohesive summary.',
    '', 'MUST PRESERVE:',
    '- Active tasks and their current status (in-progress, blocked, pending)',
    '- Batch operation progress (e.g., "5/17 items completed")',
    '- The last thing the user requested and what was being done about it',
    '- Decisions made and their rationale',
    '- TODOs, open questions, and constraints',
    '- Any commitments or follow-ups promised',
    '', 'PRIORITIZE recent context over older history.',
].join('\n');

/**
 * Estimate token count for a message (~4 chars/token).
 */
export function estimateTokens(msg: CompactionMessage): number {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return Math.ceil(text.length / 4) + 4;
}

export function estimateMessagesTokens(messages: CompactionMessage[]): number {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

export function buildCompactionSummarizationInstructions(
    customInstructions?: string,
    instructions?: CompactionSummarizationInstructions,
): string | undefined {
    const custom = customInstructions?.trim();
    const policy = instructions?.identifierPolicy ?? 'strict';
    const identifierPreservation = policy === 'off' ? undefined
        : policy === 'custom' ? (instructions?.identifierInstructions?.trim() || IDENTIFIER_PRESERVATION)
        : IDENTIFIER_PRESERVATION;
    if (!identifierPreservation && !custom) return undefined;
    if (!custom) return identifierPreservation;
    if (!identifierPreservation) return `Additional focus:\n${custom}`;
    return `${identifierPreservation}\n\nAdditional focus:\n${custom}`;
}

/**
 * Split messages into N chunks by token share.
 */
export function splitMessagesByTokenShare(messages: CompactionMessage[], parts = DEFAULT_PARTS): CompactionMessage[][] {
    if (messages.length === 0) return [];
    const normalizedParts = Math.min(Math.max(1, Math.floor(parts)), messages.length);
    if (normalizedParts <= 1) return [messages];
    const totalTokens = estimateMessagesTokens(messages);
    const targetTokens = totalTokens / normalizedParts;
    const chunks: CompactionMessage[][] = [];
    let current: CompactionMessage[] = [];
    let currentTokens = 0;
    for (const msg of messages) {
        const msgTokens = estimateTokens(msg);
        if (chunks.length < normalizedParts - 1 && current.length > 0 && currentTokens + msgTokens > targetTokens) {
            chunks.push(current); current = []; currentTokens = 0;
        }
        current.push(msg); currentTokens += msgTokens;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
}

/**
 * Chunk messages by max token budget.
 */
export function chunkMessagesByMaxTokens(messages: CompactionMessage[], maxTokens: number): CompactionMessage[][] {
    if (messages.length === 0) return [];
    const effectiveMax = Math.max(1, Math.floor(maxTokens / SAFETY_MARGIN));
    const chunks: CompactionMessage[][] = [];
    let currentChunk: CompactionMessage[] = [];
    let currentTokens = 0;
    for (const msg of messages) {
        const msgTokens = estimateTokens(msg);
        if (currentChunk.length > 0 && currentTokens + msgTokens > effectiveMax) {
            chunks.push(currentChunk); currentChunk = []; currentTokens = 0;
        }
        currentChunk.push(msg); currentTokens += msgTokens;
        if (msgTokens > effectiveMax) { chunks.push(currentChunk); currentChunk = []; currentTokens = 0; }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    return chunks;
}

/**
 * Compute adaptive chunk ratio based on average message size.
 */
export function computeAdaptiveChunkRatio(messages: CompactionMessage[], contextWindow: number): number {
    if (messages.length === 0) return BASE_CHUNK_RATIO;
    const totalTokens = estimateMessagesTokens(messages);
    const avgTokens = totalTokens / messages.length;
    const safeAvgTokens = avgTokens * SAFETY_MARGIN;
    const avgRatio = safeAvgTokens / contextWindow;
    if (avgRatio > 0.1) {
        const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
        return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
    }
    return BASE_CHUNK_RATIO;
}

/**
 * Check if a single message is too large to summarize.
 */
export function isOversizedForSummary(msg: CompactionMessage, contextWindow: number): boolean {
    return estimateTokens(msg) * SAFETY_MARGIN > contextWindow * 0.5;
}

/**
 * Prune history to fit within a token budget.
 */
export function pruneHistoryForContextShare(params: {
    messages: CompactionMessage[];
    maxContextTokens: number;
    maxHistoryShare?: number;
    parts?: number;
}): {
    messages: CompactionMessage[];
    droppedCount: number;
    droppedTokens: number;
    keptTokens: number;
    budgetTokens: number;
} {
    const maxHistoryShare = params.maxHistoryShare ?? 0.5;
    const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));
    let keptMessages = [...params.messages];
    let droppedCount = 0;
    let droppedTokens = 0;
    const parts = Math.min(Math.max(1, Math.floor(params.parts ?? DEFAULT_PARTS)), keptMessages.length);
    while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
        const chunks = splitMessagesByTokenShare(keptMessages, parts);
        if (chunks.length <= 1) break;
        const [dropped, ...rest] = chunks;
        droppedCount += dropped.length;
        droppedTokens += estimateMessagesTokens(dropped);
        keptMessages = rest.flat();
    }
    return { messages: keptMessages, droppedCount, droppedTokens, keptTokens: estimateMessagesTokens(keptMessages), budgetTokens };
}

/**
 * Create a compaction summary from dropped messages (local, no LLM call).
 */
export function createLocalSummary(messages: CompactionMessage[]): string {
    if (messages.length === 0) return DEFAULT_SUMMARY_FALLBACK;
    const roles = new Map<string, number>();
    for (const msg of messages) roles.set(msg.role, (roles.get(msg.role) ?? 0) + 1);
    const parts = [...roles.entries()].map(([role, count]) => `${count} ${role}`);
    const tokens = estimateMessagesTokens(messages);
    return `Compacted ${messages.length} messages (${parts.join(', ')}; ~${Math.round(tokens / 1000)}K tokens).`;
}

export function resolveContextWindowTokens(contextWindow?: number): number {
    return Math.max(1, Math.floor(contextWindow ?? 128_000));
}

// ─── LLM Summarization (CB-compatible) ────────────────────────────────
// CoreBlow — agents/compaction.ts

import { retryAsync } from '../infra/retry.js';
import {
    stripToolResultDetails,
    repairToolUseResultPairing,
    type TranscriptMessage,
} from './session-transcript-repair.js';

const MERGE_SUMMARIES_INSTRUCTIONS = [
    'Merge these partial summaries into a single cohesive summary.',
    '',
    'MUST PRESERVE:',
    '- Active tasks and their current status (in-progress, blocked, pending)',
    '- Batch operation progress (e.g., "5/17 items completed")',
    '- The last thing the user requested and what was being done about it',
    '- Decisions made and their rationale',
    '- TODOs, open questions, and constraints',
    '- Any commitments or follow-ups promised',
    '',
    'PRIORITIZE recent context over older history. The agent needs to know',
    'what it was doing, not just what was discussed.',
].join('\n');

/** Adapter type — CoreBlow-agnostic dari model library tertentu */
export type LLMSummarizer = (params: {
    messages: CompactionMessage[];
    previousSummary?: string;
    customInstructions?: string;
    signal?: AbortSignal;
}) => Promise<string>;

/**
 * Summarize dengan progressive fallback:
 * 1. Full summarization (semua pesan, dengan retry)
 * 2. Partial summarization (skip oversized messages)
 * 3. Local summary (tanpa LLM call)
 *
 * CoreBlow — agents/compaction.ts `summarizeWithFallback`
 */
export async function summarizeWithFallback(params: {
    messages: CompactionMessage[];
    summarizer: LLMSummarizer;
    contextWindow: number;
    maxChunkTokens: number;
    customInstructions?: string;
    summarizationInstructions?: CompactionSummarizationInstructions;
    previousSummary?: string;
    signal?: AbortSignal;
}): Promise<string> {
    const { messages, contextWindow } = params;
    if (messages.length === 0) return params.previousSummary ?? 'No prior history.';

    // SECURITY: strip verbose tool result details sebelum kirim ke LLM
    const safeMessages = stripToolResultDetails(messages as TranscriptMessage[]) as CompactionMessage[];
    const chunks = chunkMessagesByMaxTokens(safeMessages, params.maxChunkTokens);

    const effectiveInstructions = buildCompactionSummarizationInstructions(
        params.customInstructions,
        params.summarizationInstructions,
    );

    // Attempt 1: Full summarization dengan retry
    try {
        let summary = params.previousSummary;
        for (const chunk of chunks) {
            summary = await retryAsync(
                () => params.summarizer({
                    messages: chunk,
                    previousSummary: summary,
                    customInstructions: effectiveInstructions,
                    signal: params.signal,
                }),
                {
                    attempts: 3,
                    minDelayMs: 500,
                    maxDelayMs: 5000,
                    jitter: 0.2,
                    label: 'compaction/summarizeChunk',
                    shouldRetry: (e) => !(e instanceof Error && e.name === 'AbortError'),
                },
            );
        }
        return summary ?? 'No prior history.';
    } catch {
        // fall through to partial
    }

    // Attempt 2: Partial summary — skip oversized messages
    const smallMessages: CompactionMessage[] = [];
    const oversizedNotes: string[] = [];
    for (const msg of messages) {
        if (isOversizedForSummary(msg, contextWindow)) {
            const tokens = estimateTokens(msg);
            oversizedNotes.push(`[Large ${msg.role} (~${Math.round(tokens / 1000)}K tokens) omitted from summary]`);
        } else {
            smallMessages.push(msg);
        }
    }
    if (smallMessages.length > 0) {
        try {
            const partialSummary = await params.summarizer({
                messages: smallMessages,
                customInstructions: effectiveInstructions,
                signal: params.signal,
            });
            const notes = oversizedNotes.length > 0 ? `\n\n${oversizedNotes.join('\n')}` : '';
            return partialSummary + notes;
        } catch {
            // fall through to local summary
        }
    }

    // Final fallback: local summary (no LLM call)
    return (
        `Context contained ${messages.length} messages (${oversizedNotes.length} oversized). ` +
        `Summary unavailable due to size limits.\n` +
        createLocalSummary(messages)
    );
}

/**
 * Summarize dalam beberapa tahap: split → summarize each part → merge summaries.
 * Berguna untuk conversation sangat panjang yang melebihi satu chunk.
 *
 * CoreBlow — agents/compaction.ts `summarizeInStages`
 */
export async function summarizeInStages(params: {
    messages: CompactionMessage[];
    summarizer: LLMSummarizer;
    contextWindow: number;
    maxChunkTokens: number;
    customInstructions?: string;
    summarizationInstructions?: CompactionSummarizationInstructions;
    previousSummary?: string;
    signal?: AbortSignal;
    parts?: number;
    minMessagesForSplit?: number;
}): Promise<string> {
    const { messages } = params;
    if (messages.length === 0) return params.previousSummary ?? 'No prior history.';

    const minForSplit = Math.max(2, params.minMessagesForSplit ?? 4);
    const parts = Math.max(1, params.parts ?? 2);
    const totalTokens = estimateMessagesTokens(messages);

    // Single-pass jika cukup kecil
    if (parts <= 1 || messages.length < minForSplit || totalTokens <= params.maxChunkTokens) {
        return summarizeWithFallback(params);
    }

    const splits = splitMessagesByTokenShare(messages, parts).filter((c) => c.length > 0);
    if (splits.length <= 1) return summarizeWithFallback(params);

    // Summarize setiap split secara independen
    const partialSummaries: string[] = [];
    for (const chunk of splits) {
        partialSummaries.push(
            await summarizeWithFallback({ ...params, messages: chunk, previousSummary: undefined }),
        );
    }

    if (partialSummaries.length === 1) return partialSummaries[0]!;

    // Merge semua partial summaries
    const mergeMessages: CompactionMessage[] = partialSummaries.map((s) => ({
        role: 'user',
        content: s,
    }));
    const custom = params.customInstructions?.trim();
    const mergeInstructions = custom
        ? `${MERGE_SUMMARIES_INSTRUCTIONS}\n\n${custom}`
        : MERGE_SUMMARIES_INSTRUCTIONS;

    return summarizeWithFallback({ ...params, messages: mergeMessages, customInstructions: mergeInstructions });
}

/**
 * Fix pruneHistoryForContextShare agar return type match reference.
 * CoreBlow return: droppedMessagesList + droppedChunks + integrasikan repairToolUseResultPairing.
 *
 * Drop-in replacement yang backward-compatible.
 */
export function pruneHistoryWithRepair(params: {
    messages: CompactionMessage[];
    maxContextTokens: number;
    maxHistoryShare?: number;
    parts?: number;
}): {
    messages: CompactionMessage[];
    droppedMessagesList: CompactionMessage[];
    droppedChunks: number;
    droppedMessages: number;
    droppedTokens: number;
    keptTokens: number;
    budgetTokens: number;
} {
    const maxHistoryShare = params.maxHistoryShare ?? 0.5;
    const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));
    let keptMessages = params.messages;
    const allDroppedMessages: CompactionMessage[] = [];
    let droppedChunks = 0;
    let droppedMessages = 0;
    let droppedTokens = 0;
    const parts = Math.min(Math.max(1, Math.floor(params.parts ?? 2)), keptMessages.length);

    while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
        const chunks = splitMessagesByTokenShare(keptMessages, parts);
        if (chunks.length <= 1) break;
        const [dropped, ...rest] = chunks;
        const flatRest = rest.flat();

        // Repair orphaned tool pairs setelah drop (sesuai pola OC)
        const repairReport = repairToolUseResultPairing(flatRest as TranscriptMessage[]);
        const repairedKept = repairReport.messages as CompactionMessage[];
        const orphanedCount = repairReport.droppedOrphanCount;

        droppedChunks += 1;
        droppedMessages += (dropped?.length ?? 0) + orphanedCount;
        droppedTokens += estimateMessagesTokens(dropped ?? []);
        allDroppedMessages.push(...(dropped ?? []));
        keptMessages = repairedKept;
    }

    return {
        messages: keptMessages,
        droppedMessagesList: allDroppedMessages,
        droppedChunks,
        droppedMessages,
        droppedTokens,
        keptTokens: estimateMessagesTokens(keptMessages),
        budgetTokens,
    };
}
