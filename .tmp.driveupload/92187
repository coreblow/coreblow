import type { GatewayLogger } from './gateway-types.js';

export function formatForLog(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

export function logWs(log: GatewayLogger, direction: "in" | "out", clientId: string, method: string, payload?: unknown) {
    if (!shouldLogWs()) return;
    const dirStr = direction === "in" ? "<-" : "->";
    const payloadStr = payload ? JSON.stringify(payload).slice(0, 100) : "";
    log.debug(`WS ${dirStr} [${clientId}] ${method} ${payloadStr}`);
}

export function shouldLogWs(): boolean {
    return process.env.GATEWAY_WS_LOG === "1" || process.env.GATEWAY_WS_LOG === "true";
}

export function summarizeAgentEventForWsLog(event: unknown): string {
    if (!event || typeof event !== 'object') return "unknown event";
    return typeof (event as Record<string, unknown>).type === "string" ? (event as Record<string, unknown>).type as string : "event";
}
