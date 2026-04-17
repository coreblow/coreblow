/**
 * CoreBlow AutoPilot — hasActiveRun
 *
 * Check if a session has an active run.
 */
import { activeAborts } from './abort.data.js';

export function hasActiveRun(sessionKey: string): boolean {
    const record = activeAborts.get(sessionKey);
    return !!record && !record.controller.signal.aborted;
}
