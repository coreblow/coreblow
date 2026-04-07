/**
 * agents/image-sanitization.ts
 * Image validation and sanitization for multi-modal content.
 */
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

export function isAllowedImageType(mimeType: string): boolean { return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()); }
export function isAllowedImageSize(sizeBytes: number): boolean { return sizeBytes > 0 && sizeBytes <= MAX_IMAGE_SIZE; }
export function validateImageInput(input: { mimeType: string; sizeBytes: number; data?: string }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!isAllowedImageType(input.mimeType)) errors.push(`Unsupported MIME type: ${input.mimeType}`);
    if (!isAllowedImageSize(input.sizeBytes)) errors.push(`Image size ${input.sizeBytes} exceeds limit ${MAX_IMAGE_SIZE}`);
    if (input.data && !isValidBase64(input.data)) errors.push('Invalid base64 data');
    return { valid: errors.length === 0, errors };
}
export function isValidBase64(data: string): boolean { try { return Buffer.from(data, 'base64').toString('base64') === data.replace(/\s/g, ''); } catch { return false; } }
export function inferMimeType(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
    return ext ? map[ext] ?? null : null;
}
