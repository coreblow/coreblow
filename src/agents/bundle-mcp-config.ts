import { normalizeConfiguredMcpServers } from "../config/mcp-config.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  loadEnabledBundleMcpConfig,
  type BundleMcpConfig,
  type BundleMcpDiagnostic,
  type BundleMcpServerConfig,
} from "../plugins/bundle-mcp.js";

type MergedBundleMcpConfig = {
  config: BundleMcpConfig;
  diagnostics: BundleMcpDiagnostic[];
};

type BundleMcpServerMapper = (server: BundleMcpServerConfig, name: string) => BundleMcpServerConfig;

const TRANSPORT_TO_CLI_BUNDLE_TYPE: Record<string, string> = {
  "streamable-http": "http",
  http: "http",
  sse: "sse",
  stdio: "stdio",
};

/**
 * User config stores MCP transport names, while CLI backends such as
 * Claude Code and Gemini expect a downstream `type` field.
 */
export function toCliBundleMcpServerConfig(server: BundleMcpServerConfig): BundleMcpServerConfig {
  const next = { ...server } as Record<string, unknown>;
  const rawTransport = next.transport;
  delete next.transport;
  if (typeof next.type === "string") {
    return next as BundleMcpServerConfig;
  }
  if (typeof rawTransport === "string") {
    const mapped = TRANSPORT_TO_CLI_BUNDLE_TYPE[rawTransport];
    if (mapped) {
      next.type = mapped;
    }
  }
  return next as BundleMcpServerConfig;
}

export function loadMergedBundleMcpConfig(params: {
  workspaceDir: string;
  cfg?: CoreBlowConfig;
  mapConfiguredServer?: BundleMcpServerMapper;
}): MergedBundleMcpConfig {
  const bundleMcp = loadEnabledBundleMcpConfig({
    workspaceDir: params.workspaceDir,
    cfg: params.cfg,
  });
  const configuredMcp = normalizeConfiguredMcpServers(params.cfg?.mcp?.servers);
  const mapConfiguredServer = params.mapConfiguredServer ?? ((server) => server);

  return {
    config: {
      mcpServers: {
        ...bundleMcp.config.mcpServers,
        ...Object.fromEntries(
          Object.entries(configuredMcp).map(([name, server]) => [
            name,
            mapConfiguredServer(server as BundleMcpServerConfig, name),
          ]),
        ),
      } satisfies BundleMcpConfig["mcpServers"],
    },
    diagnostics: bundleMcp.diagnostics,
  };
}
