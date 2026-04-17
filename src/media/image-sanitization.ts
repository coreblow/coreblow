export function sanitizeImage(buffer: Buffer): Buffer { return buffer; }
export function isImageSafe(buffer: Buffer): boolean { return buffer.length > 0 && buffer.length < 10 * 1024 * 1024; }
