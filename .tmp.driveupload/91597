/** Live auth key monitoring. */
export function maskKey(key: string): string { return key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : '***'; }
export function isKeyExpiring(expiresAt: number, warnMs = 86_400_000): boolean { return expiresAt - Date.now() < warnMs; }
