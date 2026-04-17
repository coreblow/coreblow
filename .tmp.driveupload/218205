/**
 * CoreBlow AutoPilot — createRunAbort
 *
 * Create an abort controller for a run.
 */
import type { AbortRecord } from './types.js';
import { abortRun } from './abort-run.js';
import { activeAborts } from './abort.data.js';

export function createRunAbort(sessionKey: string, runId: string): AbortController {
    abortRun(sessionKey, 'new_message');

    const controller = new AbortController();
    activeAborts.set(sessionKey, { controller, sessionKey, runId });
    return controller;
}
