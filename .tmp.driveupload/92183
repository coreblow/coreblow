import type { NodeEventContext, NodeEvent } from "./gateway-types.js";

export function handleNodeEvent(ctx: NodeEventContext, nodeId: string, evt: NodeEvent) {
    if (!evt || !evt.event) return;

    switch (evt.event) {
        case "voice.transcript":
            ctx.logGateway.debug(`Node ${nodeId} reported voice transcript`);
            break;
        case "agent.request":
            ctx.logGateway.debug(`Node ${nodeId} requested agent intent`);
            break;
        case "notifications.changed":
            ctx.logGateway.debug(`Node ${nodeId} notification changed`);
            break;
        case "exec.started":
        case "exec.finished":
        case "exec.denied":
            ctx.logGateway.debug(`Node ${nodeId} exec event: ${evt.event}`);
            break;
        case "chat.subscribe":
            if (evt.payloadJSON) {
                const sessionKey = tryParseSessionKey(evt.payloadJSON);
                if (sessionKey && ctx.nodeSubscribe) {
                    ctx.nodeSubscribe(nodeId, sessionKey);
                }
            }
            break;
        case "chat.unsubscribe":
            if (evt.payloadJSON) {
                const sessionKey = tryParseSessionKey(evt.payloadJSON);
                if (sessionKey && ctx.nodeUnsubscribe) {
                    ctx.nodeUnsubscribe(nodeId, sessionKey);
                }
            }
            break;
        default:
            ctx.logGateway.debug(`Node ${nodeId} sent unhandled event: ${evt.event}`);
            break;
    }
}

function tryParseSessionKey(payloadJSON: string) {
    try {
        const obj = JSON.parse(payloadJSON);
        return obj?.sessionKey;
    } catch {
        return null;
    }
}
