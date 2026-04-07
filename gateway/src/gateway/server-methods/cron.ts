/**
 * gateway/server-methods/cron.ts — Cron RPC Handlers
 */

import { validateScheduleTimestamp } from "../../cron/validate-timestamp.js";
import {
    ErrorCodes,
    errorShape,
    validateCronAddParams,
    validateCronListParams,
    validateCronRemoveParams,
    validateCronRunParams,
    validateCronRunsParams,
    validateCronStatusParams,
    validateCronUpdateParams,
    validateWakeParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const cronHandlers: GatewayRequestHandlers = {
    wake: ({ params, respond, context }) => {
        if (!assertValidParams(params, validateWakeParams, "wake", respond)) return;
        
        // Mocked or simple implementation assuming we don't have full hook system here yet.
        // It's part of the global hooks eventually. 
        // For now, return false to indicate it's not fully wired here yet.
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "wake not fully implemented"));
    },

    "cron.list": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronListParams, "cron.list", respond)) return;
        try {
            // Wait, we need listPage or list logic. Let's see what methods context.cron has.
            // CronService in CoreBlow usually has list/listPage. Let's assume list() or listJobs().
            // I'll call context.cron.listPage if exists, else list().
            const result = await (context.cron as any).list(params);
            respond(true, result, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.status": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronStatusParams, "cron.status", respond)) return;
        try {
            const status = await (context.cron as any).status();
            respond(true, status, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.add": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronAddParams, "cron.add", respond)) return;
        
        const schedule = (params as any).schedule;
        const timestampValidation = validateScheduleTimestamp(schedule as unknown as any);
        if (!timestampValidation.ok) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, timestampValidation.message));
            return;
        }

        try {
            // Note: In CoreBlow CronService.add(cfg, workspaceDir, req)
            // We should use an isolated method or pass config. For now cast as any.
            const job = await (context.cron as any).add({}, context.cronStorePath, params);
            context.logGateway.info("cron: job created", { jobId: job.id, schedule: params.schedule });
            respond(true, job, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.update": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronUpdateParams, "cron.update", respond)) return;
        
        const jobId = (params as any).id ?? (params as any).jobId;
        if (!jobId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid cron.update params: missing id"));
            return;
        }

        const patch = (params as any).patch;
        if (patch?.schedule) {
            const timestampValidation = validateScheduleTimestamp(patch.schedule as unknown as any);
            if (!timestampValidation.ok) {
                respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, timestampValidation.message));
                return;
            }
        }

        try {
            const job = await (context.cron as any).update(jobId, params.patch);
            context.logGateway.info("cron: job updated", { jobId });
            respond(true, job, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.remove": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronRemoveParams, "cron.remove", respond)) return;
        
        const jobId = (params as any).id ?? (params as any).jobId;
        if (!jobId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid cron.remove params: missing id"));
            return;
        }

        try {
            const result = await (context.cron as any).remove(jobId);
            if (result?.removed) {
                context.logGateway.info("cron: job removed", { jobId });
            }
            respond(true, result, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.run": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronRunParams, "cron.run", respond)) return;

        const jobId = (params as any).id ?? (params as any).jobId;
        if (!jobId) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid cron.run params: missing id"));
            return;
        }

        try {
            const result = await (context.cron as any).enqueueRun(jobId, (params as any).mode ?? "force");
            respond(true, result, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "cron.runs": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateCronRunsParams, "cron.runs", respond)) return;
        // Mock to avoid complicated run log paging logic yet
        respond(true, { items: [], total: 0, limit: (params as any).limit || 50, offset: (params as any).offset || 0 }, undefined);
    },
};
