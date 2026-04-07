/** ACP parent stream communication. */
export interface ParentStreamMessage { type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content?: string; }
export function encodeParentMessage(msg: ParentStreamMessage): string { return JSON.stringify(msg); }
export function decodeParentMessage(data: string): ParentStreamMessage | null { try { return JSON.parse(data); } catch { return null; } }
