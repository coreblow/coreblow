/**
 * agents/tool-call-id.ts
 * Unique tool call ID generation.
 */
import { randomBytes } from 'node:crypto';
let counter = 0;
export function generateToolCallId(prefix = 'toolu'): string { return `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36)}_${randomBytes(4).toString('hex')}`; }
export function isValidToolCallId(id: string): boolean { return typeof id === 'string' && id.length > 0 && id.length < 128; }
export function extractToolCallPrefix(id: string): string | null { const m = id.match(/^([a-z]+)_/); return m ? m[1] : null; }
