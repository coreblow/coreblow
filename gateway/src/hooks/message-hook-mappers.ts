/**
 * hooks/message-hook-mappers.ts — Message format transformations and event mapping.
 *
 * Full event mapping: markdown ↔ HTML ↔ plaintext, channel-specific formatting,
 * message event extraction, and payload normalization.
 */

// ─── Format Converters ──────────────────────────────────────────────

/** Markdown → HTML. */
export function markdownToHtml(md: string): string {
    let html = md;
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>\n');
    return html;
}

/** HTML → plaintext. */
export function htmlToPlaintext(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

/** Markdown → plaintext. */
export function markdownToPlaintext(md: string): string {
    return md
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '[code block]')
        .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
        .replace(/^#+\s+/gm, '');
}

// ─── Channel-Specific Formatting ───────────────────────────────────

export type SupportedChannel = 'discord' | 'slack' | 'telegram' | 'whatsapp' | 'html' | 'plain';

/** Channel-specific formatting. */
export function formatForChannel(md: string, channel: SupportedChannel): string {
    switch (channel) {
        case 'discord':
            return md; // Discord supports markdown natively
        case 'slack': {
            let out = md;
            out = out.replace(/\*\*(.+?)\*\*/g, '\x01$1\x01'); // temp-mark bold
            out = out.replace(/\*(.+?)\*/g, '_$1_'); // italic
            out = out.replace(/\x01(.+?)\x01/g, '*$1*'); // restore bold as Slack bold
            out = out.replace(/```(\w+)?\n/g, '```\n');
            return out;
        }
        case 'telegram':
            return md; // Telegram supports markdown
        case 'whatsapp': {
            // WhatsApp has limited markdown: *bold*, _italic_, ~strikethrough~, ```code```
            let out = md;
            out = out.replace(/\*\*(.+?)\*\*/g, '*$1*');
            out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
            return out;
        }
        case 'html':
            return markdownToHtml(md);
        case 'plain':
            return markdownToPlaintext(md);
    }
}

// ─── Event Payload Mapping ──────────────────────────────────────────

export interface InboundMessageEvent {
    from: string;
    content: string;
    channelId: string;
    timestamp: number;
    conversationId?: string;
    messageId?: string;
    metadata?: Record<string, unknown>;
}

export interface OutboundMessageEvent {
    to: string;
    content: string;
    channelId: string;
    format: SupportedChannel;
    timestamp: number;
    conversationId?: string;
}

/**
 * Normalize a raw inbound message into a standard InboundMessageEvent.
 * Handles missing fields with sensible defaults.
 */
export function normalizeInboundMessage(raw: Record<string, unknown>): InboundMessageEvent {
    return {
        from: String(raw.from ?? raw.sender ?? raw.userId ?? 'unknown'),
        content: String(raw.content ?? raw.body ?? raw.text ?? raw.message ?? ''),
        channelId: String(raw.channelId ?? raw.channel ?? raw.provider ?? 'unknown'),
        timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
        conversationId: raw.conversationId as string | undefined,
        messageId: raw.messageId as string | undefined,
        metadata: raw.metadata as Record<string, unknown> | undefined,
    };
}

/**
 * Build an OutboundMessageEvent from agent response and target channel.
 */
export function buildOutboundMessage(
    agentResponse: string,
    target: { to: string; channelId: string; conversationId?: string },
    format: SupportedChannel = 'plain',
): OutboundMessageEvent {
    return {
        to: target.to,
        content: formatForChannel(agentResponse, format),
        channelId: target.channelId,
        format,
        timestamp: Date.now(),
        conversationId: target.conversationId,
    };
}

/**
 * Extract sender display name from various raw message formats.
 */
export function extractSenderName(raw: Record<string, unknown>): string {
    return String(
        raw.senderName ??
        raw.displayName ??
        raw.authorName ??
        raw.from ??
        'Unknown'
    );
}

/**
 * Truncate message content to a specified length with ellipsis.
 */
export function truncateMessage(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength - 3) + '...';
}
