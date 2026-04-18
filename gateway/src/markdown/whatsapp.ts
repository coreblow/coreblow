/**
 * markdown/whatsapp.ts
 * WhatsApp-flavored markdown conversion.
 * Ported from CoreBlow src/markdown/whatsapp.ts.
 */

import { parseMarkdownToIR, type MarkdownIR } from './ir.js';
import { renderMarkdownWithMarkers, type RenderStyleMap } from './render.js';

const WHATSAPP_MARKERS: RenderStyleMap = {
    bold: { open: '*', close: '*' },
    italic: { open: '_', close: '_' },
    strikethrough: { open: '~', close: '~' },
    code: { open: '```', close: '```' },
    code_block: { open: '```\n', close: '\n```' },
};

/**
 * Convert standard markdown to WhatsApp formatting.
 */
export function markdownToWhatsApp(markdown: string): string {
    const ir = parseMarkdownToIR(markdown);
    return renderMarkdownWithMarkers(ir, { styleMarkers: WHATSAPP_MARKERS, escapeText: (t) => t });
}

/**
 * Convert WhatsApp formatting to standard markdown.
 */
export function whatsAppToMarkdown(text: string): string {
    let result = text;
    // WhatsApp bold (*text*) → markdown bold (**text**)
    result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '**$1**');
    // WhatsApp italic (_text_) → markdown italic (*text*)
    // Be careful not to convert underscores in URLs
    result = result.replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '*$1*');
    // WhatsApp strikethrough (~text~) → markdown (~~text~~)
    result = result.replace(/(?<!~)~([^~\n]+)~(?!~)/g, '~~$1~~');
    return result;
}

/**
 * Strip all WhatsApp formatting.
 */
export function stripWhatsAppFormatting(text: string): string {
    let result = text;
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/_([^_]+)_/g, '$1');
    result = result.replace(/~([^~]+)~/g, '$1');
    result = result.replace(/```([^`]+)```/g, '$1');
    return result;
}
