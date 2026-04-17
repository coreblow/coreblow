import { validateTalkStartParams, validateTalkStopParams, validateTalkTranscribeParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const talkHandlers: GatewayRequestHandlers = {
    "talk.start": ({ params, respond }) => {
        if (!assertValidParams(params, validateTalkStartParams, "talk.start", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "Talk mode is disabled." });
    },
    "talk.stop": ({ params, respond }) => {
        if (!assertValidParams(params, validateTalkStopParams, "talk.stop", respond)) return;
        respond(true, { ok: true }, undefined);
    },
    "talk.transcribe": ({ params, respond }) => {
        if (!assertValidParams(params, validateTalkTranscribeParams, "talk.transcribe", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "Transcription is disabled." });
    }
};
