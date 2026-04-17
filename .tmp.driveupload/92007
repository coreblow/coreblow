import { validateVoicewakeConfigureParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const voicewakeHandlers: GatewayRequestHandlers = {
    "voicewake.configure": ({ params, respond }) => {
        if (!assertValidParams(params, validateVoicewakeConfigureParams, "voicewake.configure", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "Voice wake is disabled." });
    }
};
