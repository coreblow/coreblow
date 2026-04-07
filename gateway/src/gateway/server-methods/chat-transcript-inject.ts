import type { GatewayRequestHandlers } from "./types.js";

export const chatTranscriptInjectHandlers: GatewayRequestHandlers = {
    "chat.inject": async ({ params, respond }) => {
        respond(true, { injected: true });
    }
};
