import {
    validateChannelsStatusParams,
    validateChannelsLogoutParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const channelsHandlers: GatewayRequestHandlers = {
    "channels.status": ({ params, respond }) => {
        if (!assertValidParams(params, validateChannelsStatusParams, "channels.status", respond)) return;
        respond(true, {
            ts: Date.now(),
            channelOrder: [],
            channels: {},
            channelAccounts: {}
        }, undefined);
    },
    "channels.logout": ({ params, respond }) => {
        if (!assertValidParams(params, validateChannelsLogoutParams, "channels.logout", respond)) return;
        const p = params as { channel: string; accountId?: string };
        respond(true, { channel: p.channel, accountId: p.accountId, cleared: true }, undefined);
    }
};
