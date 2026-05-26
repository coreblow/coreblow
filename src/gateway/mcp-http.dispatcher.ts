import type { IncomingMessage, ServerResponse } from "node:http";
import { getRuntimeConfigSnapshot, loadConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import { logWarn } from "../logger.js";
import { handleMcpJsonRpc } from "./mcp-http.handlers.js";
import { jsonRpcError, type JsonRpcRequest } from "./mcp-http.protocol.js";
import { readMcpHttpBody, resolveMcpRequestContext } from "./mcp-http.request.js";
import { McpLoopbackToolCache } from "./mcp-http.runtime.js";

const toolCache = new McpLoopbackToolCache();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentRuntimeConfig() {
  return getRuntimeConfigSnapshot() ?? loadConfig();
}

export async function dispatchMcpLoopbackRequest(params: {
  req: IncomingMessage;
  res: ServerResponse;
  auth: { senderIsOwner: boolean };
  signal: AbortSignal;
  logTraffic: (step: string, details: Record<string, unknown>) => void;
}): Promise<void> {
  try {
    const body = await readMcpHttpBody(params.req);
    const parsed: JsonRpcRequest | JsonRpcRequest[] = JSON.parse(body);
    const cfg = getCurrentRuntimeConfig();
    const requestContext = resolveMcpRequestContext(params.req, cfg, params.auth);
    const scopedTools = toolCache.resolve({
      cfg,
      sessionKey: requestContext.sessionKey,
      messageProvider: requestContext.messageProvider,
      accountId: requestContext.accountId,
      inboundEventKind: requestContext.inboundEventKind,
      senderIsOwner: requestContext.senderIsOwner,
    });

    const messages = Array.isArray(parsed) ? parsed : [parsed];
    params.logTraffic("request", {
      batchSize: messages.length,
      methods: messages.map((message) => message.method),
      sessionKey: requestContext.sessionKey,
      inboundEventKind: requestContext.inboundEventKind,
      senderIsOwner: requestContext.senderIsOwner,
      toolCount: scopedTools.toolSchema.length,
    });

    const responses: object[] = [];
    for (const message of messages) {
      const response = await handleMcpJsonRpc({
        message,
        tools: scopedTools.tools,
        toolSchema: scopedTools.toolSchema,
        hookContext: {
          agentId: scopedTools.agentId,
          sessionKey: requestContext.sessionKey,
        },
        signal: params.signal,
      });
      if (response !== null) {
        const toolName =
          message.method === "tools/call" && isRecord(message.params)
            ? message.params.name
            : undefined;
        const isError =
          isRecord(response) && isRecord(response.result) && response.result.isError === true;
        params.logTraffic("response", {
          method: message.method,
          toolName: typeof toolName === "string" ? toolName : undefined,
          isError,
        });
        responses.push(response);
      }
    }

    if (responses.length === 0) {
      params.res.writeHead(202);
      params.res.end();
      return;
    }

    const payload = Array.isArray(parsed) ? JSON.stringify(responses) : JSON.stringify(responses[0]);
    params.res.writeHead(200, { "Content-Type": "application/json" });
    params.res.end(payload);
  } catch (error) {
    logWarn(`mcp loopback: request handling failed: ${formatErrorMessage(error)}`);
    params.logTraffic("request-failed", {
      message: formatErrorMessage(error),
    });
    if (!params.res.headersSent) {
      params.res.writeHead(400, { "Content-Type": "application/json" });
      params.res.end(JSON.stringify(jsonRpcError(null, -32700, "Parse error")));
    }
  }
}
