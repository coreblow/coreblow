/**
 * gateway/server-cron.ts — Builder for passing Gateway dependencies into the CronService
 */

import { CronService } from '../cron/engine.js';
// In a full implementation, we would inject specific config and logging capabilities into the CronService.
// For now, we will return a minimal instance of CronService.

export function buildGatewayCronService(config: unknown): CronService {
    // CoreBlow's builder takes dependencies (logger, store path) and initializes the robust service.
    // CoreBlow's CronService is slightly different, we invoke constructor or factory as needed.
    const cron = new CronService();
    return cron;
}
