/**
 * Discord Attachment Downloader
 * Downloads and validates attachments from Discord messages.
 */

export interface DownloadResult {
    url: string;
    filename: string;
    size: number;
    contentType: string;
    buffer: Buffer | null;
    error?: string;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB Discord limit

export async function downloadAttachment(url: string, filename: string): Promise<DownloadResult> {
    try {
        const res = await fetch(url);
        if (!res.ok) return { url, filename, size: 0, contentType: '', buffer: null, error: `HTTP ${res.status}` };
        const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > MAX_SIZE) return { url, filename, size: buffer.length, contentType, buffer: null, error: 'File too large' };
        return { url, filename, size: buffer.length, contentType, buffer };
    } catch (err) {
        return { url, filename, size: 0, contentType: '', buffer: null, error: err instanceof Error ? err.message : String(err) };
    }
}

export function isAllowedType(contentType: string, allowed: string[] = ['image/', 'text/', 'application/pdf']): boolean {
    return allowed.some((t) => contentType.startsWith(t));
}
