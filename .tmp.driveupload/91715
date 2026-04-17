/** MIME type utilities */
const MIME_MAP: Record<string, string> = {
    '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.zip': 'application/zip',
};
export function getMimeType(filename: string): string { const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase(); return MIME_MAP[ext] ?? 'application/octet-stream'; }
export function isTextMime(mime: string): boolean { return mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript'; }
export function isImageMime(mime: string): boolean { return mime.startsWith('image/'); }


export function detectMime(buffer: Buffer | Uint8Array): string {
    const b = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
    if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
    if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
    if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
    if (b[0] === 0x25 && b[1] === 0x50) return 'application/pdf';
    return 'application/octet-stream';
}
