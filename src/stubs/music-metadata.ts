// Stub for music-metadata — used by extensions/matrix
// In test environment, we don't need actual media metadata parsing
export function parseBuffer() { return {}; }
export function parseFile() { return {}; }
export function parseStream() { return {}; }
export default { parseBuffer, parseFile, parseStream };
