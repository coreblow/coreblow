import type { CoreBlowConfig } from "../config/config.js";
import {
  buildMcpToolSchema,
  type McpLoopbackTool,
  type McpToolSchemaEntry,
} from "./mcp-http.schema.js";
import { resolveGatewayScopedTools } from "./tools-invoke-shared.js";

export const MCP_LOOPBACK_TOOL_CACHE_TTL_MS = 30_000;
export const MCP_LOOPBACK_NATIVE_TOOL_EXCLUDE = new Set([
  "read",
  "write",
  "edit",
  "apply_patch",
  "exec",
  "process",
]);

type CachedScopedTools = {
  agentId: string | undefined;
  tools: McpLoopbackTool[];
  toolSchema: McpToolSchemaEntry[];
  configRef: CoreBlowConfig;
  time: number;
};

export class McpLoopbackToolCache {
  #entries = new Map<string, CachedScopedTools>();

  resolve(params: {
    cfg: CoreBlowConfig;
    sessionKey: string;
    messageProvider: string | undefined;
    accountId: string | undefined;
    inboundEventKind?: string | undefined;
    senderIsOwner: boolean | undefined;
  }): CachedScopedTools {
    const cacheKey = [
      params.sessionKey,
      params.messageProvider ?? "",
      params.accountId ?? "",
      params.inboundEventKind ?? "",
      params.senderIsOwner === true ? "owner" : "non-owner",
    ].join("\u0000");
    const now = Date.now();
    const cached = this.#entries.get(cacheKey);
    if (
      cached &&
      cached.configRef === params.cfg &&
      now - cached.time < MCP_LOOPBACK_TOOL_CACHE_TTL_MS
    ) {
      return cached;
    }

    const next = resolveGatewayScopedTools({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
      messageChannel: params.messageProvider,
      accountId: params.accountId,
      senderIsOwner: params.senderIsOwner === true,
      surface: "loopback",
      excludeToolNames: MCP_LOOPBACK_NATIVE_TOOL_EXCLUDE,
    });
    const nextEntry: CachedScopedTools = {
      agentId: next.agentId,
      tools: next.tools,
      toolSchema: buildMcpToolSchema(next.tools),
      configRef: params.cfg,
      time: now,
    };
    this.#entries.set(cacheKey, nextEntry);
    for (const [key, entry] of this.#entries) {
      if (now - entry.time >= MCP_LOOPBACK_TOOL_CACHE_TTL_MS) {
        this.#entries.delete(key);
      }
    }
    return nextEntry;
  }
}
