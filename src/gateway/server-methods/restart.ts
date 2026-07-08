import { emitGatewayRestart, triggerCoreBlowRestart } from "../../infra/restart.js";
import type { GatewayRequestHandlers } from "./types.js";

function normalizeReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined;
}

function normalizeSkipDeferral(value: unknown): boolean {
  return value === true;
}

export const restartHandlers: GatewayRequestHandlers = {
  "gateway.restart.request": async ({ respond, params }) => {
    const requested = emitGatewayRestart();
    if (!requested) {
      const attempt = triggerCoreBlowRestart();
      respond(true, { attempted: true, ...attempt });
    } else {
      respond(true, { requested: true });
    }
  },
  "gateway.restart.preflight": async ({ respond }) => {
    respond(true, { ready: true });
  },
};
