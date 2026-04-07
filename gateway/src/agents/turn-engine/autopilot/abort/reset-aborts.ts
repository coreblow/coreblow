/**
 * CoreBlow AutoPilot — resetAborts
 *
 * Reset all abort controllers.
 */
import { abortAll } from './abort-all.js';
import { activeAborts } from './abort.data.js';

export function resetAborts(): void {
    abortAll('system');
    activeAborts.clear();
}
