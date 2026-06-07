import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeMessageChannel } from "../utils/message-channel.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { readJsonBodyOrError, sendJson, sendMethodNotAllowed } from "./http-common.js";
import {
  authorizeScopedGatewayHttpRequestOrReply,
  getHeader,
  resolveOpenAiCompatibleHttpOperatorScopes,
  resolveOpenAiCompatibleHttpSenderIsOwner,
} from "./http-auth-utils.js";
import { invokeGatewayTool, type ToolsInvokeInput } from "./tools-invoke-shared.js";

const DEFAULT_BODY_BYTES = 2 * 1024 * 1024;

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function handleToolsInvokeHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    maxBodyBytes?: number;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/tools/invoke") {
    return false;
  }

  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return true;
  }

  const authResult = await authorizeScopedGatewayHttpRequestOrReply({
    req,
    res,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
    operatorMethod: "agent",
    resolveOperatorScopes: resolveOpenAiCompatibleHttpOperatorScopes,
  });
  if (!authResult) {
    return true;
  }

  const bodyUnknown = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? DEFAULT_BODY_BYTES);
  if (bodyUnknown === undefined) {
    return true;
  }

  const requestAuth = authResult.requestAuth;
  const outcome = await invokeGatewayTool({
    cfg: authResult.cfg,
    input: (bodyUnknown ?? {}) as ToolsInvokeInput,
    senderIsOwner: resolveOpenAiCompatibleHttpSenderIsOwner(req, requestAuth),
    messageChannel:
      normalizeMessageChannel(getHeader(req, "x-coreblow-message-channel") ?? "") ?? undefined,
    accountId: normalizeOptionalString(getHeader(req, "x-coreblow-account-id")),
    agentTo: normalizeOptionalString(getHeader(req, "x-coreblow-message-to")),
    agentThreadId: normalizeOptionalString(getHeader(req, "x-coreblow-thread-id")),
    toolCallIdPrefix: "http",
  });
  sendJson(
    res,
    outcome.status,
    outcome.ok
      ? { ok: true, result: outcome.result }
      : { ok: false, error: outcome.error },
  );
  return true;
}
