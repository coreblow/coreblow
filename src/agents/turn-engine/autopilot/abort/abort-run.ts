/**
 * CoreBlow AutoPilot — abortRun
 *
 * Abort a run for a session.
 */
import type { AbortReason } from '../types.js';
import { activeAborts } from './abort.data.js';

export function abortRun(sessionKey: string, reason?: AbortReason): boolean {
    const record = activeAborts.get(sessionKey);
    if (!record) return false;
    if (!record.controller.signal.aborted) {
        record.reason = reason ?? 'user';
        record.abortedAt = Date.now();
        record.controller.abort(reason);
    }
    activeAborts.delete(sessionKey);
    return true;
}
