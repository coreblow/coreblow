/**
 * agents/content-blocks.ts
 * Content block parsing and building for multi-modal agent messages.
 * Ported from CoreBlow src/agents/content-blocks.ts.
 */

export type ContentBlockType = 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking' | 'redacted';

export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ImageBlock {
    type: 'image';
    source: { type: 'base64'; media_type: string; data: string } | { type: 'url'; url: string };
}

export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string | ContentBlock[];
    is_error?: boolean;
}

export interface ThinkingBlock {
    type: 'thinking';
    thinking: string;
}

export interface RedactedBlock {
    type: 'redacted';
    reason: string;
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | RedactedBlock;

/**
 * Normalize a message content value to ContentBlock array.
 */
export function normalizeContent(content: string | ContentBlock[] | null | undefined): ContentBlock[] {
    if (!content) return [];
    if (typeof content === 'string') return [{ type: 'text', text: content }];
    return content;
}

/**
 * Extract all text from content blocks.
 */
export function extractText(blocks: ContentBlock[]): string {
    return blocks
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
}

/**
 * Extract all tool uses from content blocks.
 */
export function extractToolUses(blocks: ContentBlock[]): ToolUseBlock[] {
    return blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}

/**
 * Extract thinking blocks.
 */
export function extractThinking(blocks: ContentBlock[]): string[] {
    return blocks.filter((b): b is ThinkingBlock => b.type === 'thinking').map((b) => b.thinking);
}

/**
 * Count blocks by type.
 */
export function countBlocksByType(blocks: ContentBlock[]): Record<ContentBlockType, number> {
    const counts: Record<string, number> = { text: 0, image: 0, tool_use: 0, tool_result: 0, thinking: 0, redacted: 0 };
    for (const b of blocks) counts[b.type] = (counts[b.type] ?? 0) + 1;
    return counts as Record<ContentBlockType, number>;
}

/**
 * Build a text content block.
 */
export function text(t: string): TextBlock { return { type: 'text', text: t }; }

/**
 * Build a tool use content block.
 */
export function toolUse(id: string, name: string, input: Record<string, unknown>): ToolUseBlock {
    return { type: 'tool_use', id, name, input };
}

/**
 * Build a tool result content block.
 */
export function toolResult(toolUseId: string, content: string, isError = false): ToolResultBlock {
    return { type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError || undefined };
}

/**
 * Check if content has any tool use blocks.
 */
export function hasToolUse(blocks: ContentBlock[]): boolean {
    return blocks.some((b) => b.type === 'tool_use');
}

/**
 * Redact sensitive content in blocks.
 */
export function redactBlocks(blocks: ContentBlock[], predicate: (block: ContentBlock) => boolean): ContentBlock[] {
    return blocks.map((b) => predicate(b) ? { type: 'redacted' as const, reason: 'sensitive' } : b);
}
