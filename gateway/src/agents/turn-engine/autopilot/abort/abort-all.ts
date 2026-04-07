/**
 * CoreBlow AutoPilot — abortAll
 *
 * Abort all active runs.
 */
import type { AbortReason } from '../types.js';
import { activeAborts } from './abort.data.js';
import { abortRun } from './abort-run.js';

export function abortAll(reason?: AbortReason): number {
    let count = 0;
    for (const [sessionKey] of activeAborts) {
        if (abortRun(sessionKey, reason ?? 'system')) count++;
    }
    return count;
}
