// Add sanitization rules for chat
export function sanitizeChatInput(input: string): string {
    if (!input) return "";
    // Basic XSS/Injection sanitization
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "[redacted script]");
}

/**
 * Validate and sanitize a chat.send message input.
 * Returns { ok, sanitized, error? }.
 */
export function sanitizeChatSendMessageInput(msg: string): { ok: boolean; sanitized: string; error?: string } {
    if (typeof msg !== "string") {
        return { ok: false, sanitized: "", error: "message must be a string" };
    }
    const trimmed = msg.trim();
    if (trimmed.length === 0) {
        return { ok: false, sanitized: "", error: "message must not be empty" };
    }
    if (trimmed.length > 128_000) {
        return { ok: false, sanitized: "", error: "message exceeds maximum length" };
    }
    return { ok: true, sanitized: sanitizeChatInput(trimmed) };
}
