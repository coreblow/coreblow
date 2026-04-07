/**
 * cron/validate-timestamp.ts — Validation for CronSchedule
 */

import type { CronSchedule } from "./types.js";

export function validateScheduleTimestamp(schedule: CronSchedule): { ok: boolean; message: string } {
    if (schedule.kind === 'at') {
        const d = new Date(schedule.at);
        if (isNaN(d.getTime())) {
            return { ok: false, message: `Invalid timestamp for "at" schedule: ${schedule.at}` };
        }
        if (d.getTime() < Date.now()) {
            return { ok: false, message: `Cannot schedule in the past: ${schedule.at}` };
        }
    }
    return { ok: true, message: '' };
}
