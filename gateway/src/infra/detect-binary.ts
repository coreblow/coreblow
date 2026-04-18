/**
 * CoreBlow — Binary Detection
 */
export function isBinaryBuffer(buffer: Buffer, sampleSize = 512): boolean {
  const len = Math.min(buffer.length, sampleSize);
  for (let i = 0; i < len; i++) {
    const byte = buffer[i];
    if (byte === 0) return true;
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) return true;
  }
  return false;
}

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.flac',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.wasm', '.class',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

export function hasBinaryExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
