import { validateTtsSynthesizeParams, validateTtsVoicesParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const ttsHandlers: GatewayRequestHandlers = {
    "tts.synthesize": ({ params, respond }) => {
        if (!assertValidParams(params, validateTtsSynthesizeParams, "tts.synthesize", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "TTS is disabled." });
    },
    "tts.voices": ({ params, respond }) => {
        if (!assertValidParams(params, validateTtsVoicesParams, "tts.voices", respond)) return;
        respond(true, { voices: [] }, undefined);
    }
};
