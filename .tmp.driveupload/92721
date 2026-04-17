/**
 * auto-reply/inbound-context.ts
 * Inbound message preprocessing — strip mentions, detect language, extract intent.
 */

import { stripBotMention } from './command-detection.js';
import type { InboundMessage } from './types.js';

export interface InboundContext {
    cleanContent: string;
    language: string;
    isQuestion: boolean;
    hasAttachments: boolean;
    isReply: boolean;
    isThread: boolean;
    mentionsBots: boolean;
    estimatedTokens: number;
}

/** Build context from an inbound message. */
export function buildInboundContext(msg: InboundMessage): InboundContext {
    const cleanContent = stripBotMention(msg.content);

    return {
        cleanContent,
        language: detectLanguage(cleanContent),
        isQuestion: isQuestion(cleanContent),
        hasAttachments: (msg.attachments?.length ?? 0) > 0,
        isReply: !!msg.replyTo,
        isThread: !!msg.threadId,
        mentionsBots: msg.content !== cleanContent,
        estimatedTokens: Math.ceil(cleanContent.length / 4),
    };
}

/** Simple language detection (basic heuristic). */
function detectLanguage(text: string): string {
    // Simple heuristic — check for common CJK/Arabic/Cyrillic characters
    if (/[\u3000-\u9fff]/.test(text)) return 'ja'; // Japanese/Chinese
    if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Korean
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
    if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian/Cyrillic
    if (/[àáâãäåèéêëìíîïòóôõöùúûüñç]/i.test(text)) {
        // Could be French, Spanish, Portuguese, etc.
        if (/\b(le|la|les|des|un|une|du|au)\b/i.test(text)) return 'fr';
        if (/\b(el|la|los|las|un|una|del|al)\b/i.test(text)) return 'es';
    }
    // Check Indonesian/Malay
    if (/\b(dan|yang|di|ke|dari|untuk|dengan|ini|itu|adalah)\b/i.test(text)) return 'id';
    return 'en';
}

/** Check if text looks like a question. */
function isQuestion(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.endsWith('?')) return true;
    if (/^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did|will)\b/i.test(trimmed)) return true;
    if (/^(apa|bagaimana|kenapa|mengapa|kapan|dimana|siapa)\b/i.test(trimmed)) return true;
    return false;
}
