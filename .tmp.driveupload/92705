/**
 * auto-reply/reply/normalize-reply.ts
 * Output normalization — strip thinking tags, format per channel.
 */

/** Strip <thinking>...</thinking> tags from AI output. */
export function stripThinkingTags(content: string): string {
    return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

/** Strip assistant prefixes like "Assistant:" or "Bot:". */
export function stripAssistantPrefix(content: string): string {
    return content.replace(/^(assistant|bot|ai|coreblow)\s*:\s*/i, '').trim();
}

/** Normalize markdown for platforms that don't support it. */
export function stripMarkdown(content: string): string {
    return content
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim()) // code blocks
        .replace(/`([^`]+)`/g, '$1') // inline code
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1') // italic
        .replace(/~~([^~]+)~~/g, '$1') // strikethrough
        .replace(/^#+\s+/gm, '') // headers
        .replace(/^\s*[-*]\s+/gm, '• ') // bullet points
        .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + ' ') // numbered lists
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
        .trim();
}

/** Format reply content for a specific platform. */
export function normalizeReply(content: string, platform: string): string {
    let normalized = stripThinkingTags(content);
    normalized = stripAssistantPrefix(normalized);

    // Platform-specific formatting
    switch (platform) {
        case 'discord':
            // Discord supports markdown natively, keep as-is
            break;

        case 'telegram':
            // Telegram supports some markdown, keep most of it
            break;

        case 'whatsapp':
        case 'sms':
            // Strip all markdown for plain text platforms
            normalized = stripMarkdown(normalized);
            break;

        case 'slack':
            // Convert standard markdown to Slack mrkdwn
            normalized = normalized
                .replace(/\*\*([^*]+)\*\*/g, '*$1*') // **bold** → *bold*
                .replace(/\*([^*]+)\*/g, '_$1_');     // *italic* → _italic_
            break;

        default:
            break;
    }

    return normalized.trim();
}

/** Truncate reply if it exceeds max length. */
export function truncateReply(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength - 3) + '...';
}
