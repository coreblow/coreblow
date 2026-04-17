/**
 * src/acp/event-mapper.ts
 * Maps internal gateway events to ACP session updates
 * Extracts text and attachments from ACP content blocks
 */

import type { ContentBlock, ToolKind } from './types.js';

/**
 * Extract plain text from ACP content blocks
 */
export function extractTextFromPrompt(blocks: ContentBlock[], maxBytes?: number): string {
    const parts: string[] = [];
    let totalBytes = 0;

    for (const block of blocks) {
        let text: string | undefined;

        if (block.type === 'text') {
            text = block.text;
        } else if (block.type === 'resource' && block.text) {
            text = block.text;
        } else if (block.type === 'resource_link') {
            const title = block.title ? ` (${block.title})` : '';
            text = block.uri ? `[Resource${title}] ${block.uri}` : `[Resource${title}]`;
        }

        if (text !== undefined) {
            if (maxBytes !== undefined) {
                totalBytes += Buffer.byteLength(text, 'utf-8') + (parts.length > 0 ? 1 : 0);
                if (totalBytes > maxBytes) {
                    throw new Error(`Prompt exceeds maximum allowed size of ${maxBytes} bytes`);
                }
            }
            parts.push(text);
        }
    }

    return parts.join('\n');
}

/**
 * Extract image attachments from content blocks
 */
export function extractAttachments(blocks: ContentBlock[]): { type: string; mimeType: string; content: string }[] {
    return blocks
        .filter(b => b.type === 'image' && b.data && b.mimeType)
        .map(b => ({
            type: 'image',
            mimeType: b.mimeType!,
            content: b.data!,
        }));
}

/**
 * Infer tool kind from tool name
 */
export function inferToolKind(name?: string): ToolKind {
    if (!name) return 'other';
    const n = name.toLowerCase();
    if (n.includes('read') || n.includes('view')) return 'read';
    if (n.includes('write') || n.includes('edit') || n.includes('create')) return 'edit';
    if (n.includes('delete') || n.includes('remove')) return 'delete';
    if (n.includes('move') || n.includes('rename')) return 'move';
    if (n.includes('search') || n.includes('find') || n.includes('grep')) return 'search';
    if (n.includes('exec') || n.includes('run') || n.includes('bash') || n.includes('shell')) return 'execute';
    if (n.includes('fetch') || n.includes('http') || n.includes('curl')) return 'fetch';
    return 'other';
}

/**
 * Format tool title with arguments for display
 */
export function formatToolTitle(name: string | undefined, args?: Record<string, unknown>): string {
    const base = name ?? 'tool';
    if (!args || Object.keys(args).length === 0) return base;

    const parts = Object.entries(args).map(([key, value]) => {
        const raw = typeof value === 'string' ? value : JSON.stringify(value);
        const safe = raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
        return `${key}: ${safe}`;
    });

    return `${base}: ${parts.join(', ')}`;
}
