import type { IncomingMessage, ServerResponse } from "node:http";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { normalizeMessageChannel } from "../utils/message-channel.js";
import { getHeader } from "./http-utils.js";
export { validateMcpLoopbackRequest } from "./mcp-http.request-validate.js";

const MAX_MCP_BODY_BYTES = 1_048_576;

type McpInboundEventKind = "room_event" | "user_request";

type McpRequestContext = {
  sessionKey: string;
  messageProvider: string | undefined;
  accountId: string | undefined;
  inboundEventKind: McpInboundEventKind | undefined;
  senderIsOwner: boolean;
};

function normalizeOptionalString(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveScopedSessionKey(cfg: CoreBlowConfig, rawSessionKey: string | undefined): string {
  const trimmed = normalizeOptionalString(rawSessionKey);
  return !trimmed || trimmed === "main" ? resolveMainSessionKey(cfg) : trimmed;
}

function normalizeMcpInboundEventKind(value: string | undefined): McpInboundEventKind | undefined {
  const trimmed = normalizeOptionalString(value);
  return trimmed === "room_event" || trimmed === "user_request" ? trimmed : undefined;
}

export async function readMcpHttpBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_MCP_BODY_BYTES) {
        req.destroy();
        reject(new Error(`Request body exceeds ${MAX_MCP_BODY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export function resolveMcpRequestContext(
  req: IncomingMessage,
  cfg: CoreBlowConfig,
  auth: { senderIsOwner: boolean },
): McpRequestContext {
  return {
    sessionKey: resolveScopedSessionKey(cfg, getHeader(req, "x-session-key")),
    messageProvider:
      normalizeMessageChannel(getHeader(req, "x-coreblow-message-channel")) ?? undefined,
    accountId: normalizeOptionalString(getHeader(req, "x-coreblow-account-id")),
    inboundEventKind: normalizeMcpInboundEventKind(getHeader(req, "x-coreblow-inbound-event-kind")),
    senderIsOwner: auth.senderIsOwner,
  };
}
