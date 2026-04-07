/**
 * src/shared/chat-envelope.ts
 * Chat envelope operations and content block parsing.
 * Ported from CoreBlow shared/chat-envelope.ts, chat-content.ts, and chat-message-content.ts.
 */

export type ChatEnvelope = {
    id?: string;
    channelId?: string;
    timestamp?: string;
    content: string;
    metadata?: Record<string, unknown>;
};

const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
    "WebChat",
    "WhatsApp",
    "Telegram",
    "Signal",
    "Slack",
    "Discord",
    "Google Chat",
    "iMessage",
    "Teams",
    "Matrix",
    "Zalo",
    "Zalo Personal",
    "BlueBubbles",
];

const MESSAGE_ID_LINE = /^\s*\[message_id:\s*[^\]]+\]\s*$/i;

function looksLikeEnvelopeHeader(header: string): boolean {
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) return true;
    if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) return true;
    return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}

// ── Envelope Stripping (from chat-envelope.ts) ──

export function stripEnvelope(text: string): string {
    const match = text.match(ENVELOPE_PREFIX);
    if (!match) return text;
    
    const header = match[1] ?? "";
    if (!looksLikeEnvelopeHeader(header)) return text;
    
    return text.slice(match[0].length);
}

export function stripMessageIdHints(text: string): string {
    if (!/\[message_id:/i.test(text)) return text;
    
    const lines = text.split(/\r?\n/);
    const filtered = lines.filter((line) => !MESSAGE_ID_LINE.test(line));
    return filtered.length === lines.length ? text : filtered.join("\n");
}

export function createChatEnvelope(content: string, metadata?: Record<string, unknown>): ChatEnvelope {
    return {
        content,
        metadata
    };
}

// ── Content Extraction (from chat-content.ts) ──

export function extractTextFromChatContent(
    content: unknown,
    opts?: {
        sanitizeText?: (text: string) => string;
        joinWith?: string;
        normalizeText?: (text: string) => string;
    },
): string | null {
    const normalize = opts?.normalizeText ?? ((text: string) => text.replace(/\s+/g, " ").trim());
    const joinWith = opts?.joinWith ?? " ";

    if (typeof content === "string") {
        const value = opts?.sanitizeText ? opts.sanitizeText(content) : content;
        const normalized = normalize(value);
        return normalized ? normalized : null;
    }

    if (!Array.isArray(content)) return null;

    const chunks: string[] = [];
    for (const block of content) {
        if (!block || typeof block !== "object") continue;
        if ((block as { type?: unknown }).type !== "text") continue;
        
        const text = (block as { text?: unknown }).text;
        if (typeof text !== "string") continue;
        
        const value = opts?.sanitizeText ? opts.sanitizeText(text) : text;
        if (value.trim()) {
            chunks.push(value);
        }
    }

    const joined = normalize(chunks.join(joinWith));
    return joined ? joined : null;
}

// ── First Block Extraction (from chat-message-content.ts) ──

export function extractFirstTextBlock(message: unknown): string | undefined {
    if (!message || typeof message !== "object") return undefined;
    
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    
    if (!Array.isArray(content) || content.length === 0) return undefined;
    
    const first = content[0];
    if (!first || typeof first !== "object") return undefined;
    
    const text = (first as { text?: unknown }).text;
    return typeof text === "string" ? text : undefined;
}
