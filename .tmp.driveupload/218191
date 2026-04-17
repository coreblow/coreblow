/**
 * CoreBlow AutoPilot — hasContent
 */
import type { ReplyPayload } from '../types.js';

export function hasContent(payload: ReplyPayload): boolean {
    return !!(payload.text?.trim() || payload.mediaUrl || payload.mediaUrls?.length);
}
