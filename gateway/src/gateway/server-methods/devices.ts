import {
    validateDevicesListParams,
    validateDevicesUnpairParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const devicesHandlers: GatewayRequestHandlers = {
    "devices.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateDevicesListParams, "devices.list", respond)) return;
        respond(true, { devices: [] }, undefined);
    },
    "devices.unpair": ({ params, respond }) => {
        if (!assertValidParams(params, validateDevicesUnpairParams, "devices.unpair", respond)) return;
        respond(true, { ok: true }, undefined);
    }
};
