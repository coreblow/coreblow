import type { ChatAttachment } from "../gateway-types.js";

export function normalizeRpcAttachmentsToChatAttachments(attachments: unknown[] | undefined) {
    if (!attachments || !Array.isArray(attachments)) return [];
    return attachments.map((att: unknown) => {
        const a = att as Record<string, unknown>;
        return {
            type: (a.type as string) || (typeof a.mimeType === 'string' && a.mimeType.startsWith("image/") ? "image" : "file"),
            mimeType: (a.mimeType as string) || "application/octet-stream",
            fileName: (a.fileName as string) || "unnamed",
            content: a.content
        };
    });
}

export async function parseMessageWithAttachments(message: string, attachments: ChatAttachment[], opts: unknown) {
    // Mock parsing
    return {
        message: message + "\n[parsed " + attachments.length + " attachments]",
        images: attachments.filter(a => a.mimeType?.startsWith("image/"))
    };
}
