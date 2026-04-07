/**
 * media-understanding/runner.ts — Media processing pipeline runner.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('media:runner');

export type MediaType = 'image' | 'audio' | 'video' | 'document';
export interface MediaItem { id: string; type: MediaType; url: string; mimeType: string; size: number }
export interface MediaResult { itemId: string; description: string; metadata: Record<string, unknown>; processingMs: number }

export interface MediaProcessor { supports: MediaType[]; process(item: MediaItem): Promise<MediaResult> }

const processors: MediaProcessor[] = [];

export function registerProcessor(processor: MediaProcessor): void { processors.push(processor); }

export async function processMedia(items: MediaItem[]): Promise<MediaResult[]> {
    const results: MediaResult[] = [];
    for (const item of items) {
        const processor = processors.find(p => p.supports.includes(item.type));
        if (!processor) { results.push({ itemId: item.id, description: `[Unsupported: ${item.type}]`, metadata: {}, processingMs: 0 }); continue; }
        const start = Date.now();
        try {
            const result = await processor.process(item);
            result.processingMs = Date.now() - start;
            results.push(result);
        } catch (err) {
            results.push({ itemId: item.id, description: `[Error: ${err instanceof Error ? err.message : String(err)}]`, metadata: {}, processingMs: Date.now() - start });
        }
    }
    return results;
}

export function clearProcessors(): void { processors.length = 0; }
