/** WebSocket utilities */
export interface WSMessage { type: string; data?: unknown; id?: string; }
export function parseWSMessage(raw: string): WSMessage | null { try { return JSON.parse(raw); } catch { return null; } }
export function serializeWSMessage(msg: WSMessage): string { return JSON.stringify(msg); }


export function rawDataToString(data: unknown): string {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
    if (Array.isArray(data)) return Buffer.concat(data.map(b => Buffer.isBuffer(b) ? b : Buffer.from(b))).toString('utf-8');
    return String(data);
}
