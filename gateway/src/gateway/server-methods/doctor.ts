/**
 * gateway/server-methods/doctor.ts — Doctor RPC Handlers
 */

import { ErrorCodes, errorShape, validateDoctorMemoryStatusParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const doctorHandlers: GatewayRequestHandlers = {
    "doctor.memory.status": async ({ params, respond, context }) => {
        if (!assertValidParams(params, validateDoctorMemoryStatusParams, "doctor.memory.status", respond)) return;

        try {
            // Mock memory payload for CoreBlow
            const payload = {
                agentId: "default",
                provider: "coreblow_memory",
                embedding: {
                    ok: true,
                },
            };
            respond(true, payload, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },
};
