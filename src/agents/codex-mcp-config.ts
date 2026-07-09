import {
  type BundleMcpConfig,
  type BundleMcpServerConfig,
} from "../plugins/bundle-mcp.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import {
  applyCommonServerConfig,
  decodeHeaderEnvPlaceholder,
  normalizeStringRecord,
} from "./cli-runner/bundle-mcp-adapter-shared.js";
import type { CodexMcpServersConfig } from "./codex-mcp-config.types.js";

export type { CodexMcpServersConfig } from "./codex-mcp-config.types.js";

function isOpenClawLoopbackMcpServer(name: string, server: BundleMcpServerConfig): boolean {
  return (
    name === "coreblow" &&
    typeof server.url === "string" &&
    /^https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/mcp(?:[?#].*)?$/.test(server.url)
  );
}

type CodexMcpToolApprovalMode = "auto" | "prompt" | "approve";

const CODEX_MCP_TOOL_APPROVAL_MODES = new Set<CodexMcpToolApprovalMode>([
  "auto",
  "prompt",
  "approve",
]);

function readCodexProjectionConfig(server: BundleMcpServerConfig): Record<string, unknown> {
  return isRecord(server.codex) ? server.codex : {};
}

function normalizeCodexToolApprovalMode(value: unknown): CodexMcpToolApprovalMode | undefined {
  return typeof value === "string" &&
    CODEX_MCP_TOOL_APPROVAL_MODES.has(value as CodexMcpToolApprovalMode)
    ? (value as CodexMcpToolApprovalMode)
    : undefined;
}

function resolveCodexDefaultToolsApprovalMode(
  server: BundleMcpServerConfig,
): CodexMcpToolApprovalMode | undefined {
  const codex = readCodexProjectionConfig(server);
  return (
    normalizeCodexToolApprovalMode(codex.defaultToolsApprovalMode) ??
    normalizeCodexToolApprovalMode(codex.default_tools_approval_mode)
  );
}

export function normalizeCodexMcpServerConfig(
  name: string,
  server: BundleMcpServerConfig,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  applyCommonServerConfig(next, server);
  const defaultToolsApprovalMode = resolveCodexDefaultToolsApprovalMode(server);
  if (defaultToolsApprovalMode) {
    next.default_tools_approval_mode = defaultToolsApprovalMode;
  } else if (isOpenClawLoopbackMcpServer(name, server)) {
    next.default_tools_approval_mode = "approve";
  }
  const httpHeaders = normalizeStringRecord(server.headers);
  if (httpHeaders) {
    const staticHeaders: Record<string, string> = {};
    const envHeaders: Record<string, string> = {};
    for (const [headerName, value] of Object.entries(httpHeaders)) {
      const decoded = decodeHeaderEnvPlaceholder(value);
      if (!decoded) {
        staticHeaders[headerName] = value;
        continue;
      }
      if (decoded.bearer && normalizeOptionalLowercaseString(headerName) === "authorization") {
        next.bearer_token_env_var = decoded.envVar;
        continue;
      }
      envHeaders[headerName] = decoded.envVar;
    }
    if (Object.keys(staticHeaders).length > 0) {
      next.http_headers = staticHeaders;
    }
    if (Object.keys(envHeaders).length > 0) {
      next.env_http_headers = envHeaders;
    }
  }
  return next;
}

export function buildCodexMcpServersConfig(config: BundleMcpConfig): CodexMcpServersConfig {
  return Object.fromEntries(
    Object.entries(config.mcpServers).map(([serverName, server]) => [
      serverName,
      normalizeCodexMcpServerConfig(serverName, server),
    ]),
  );
}
