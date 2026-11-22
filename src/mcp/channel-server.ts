import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, type CoreBlowConfig } from "../config/config.js";
import { VERSION } from "../version.js";
import { CoreBlowChannelBridge } from "./channel-bridge.js";
import {
  ChannelPermissionRequestSchema,
  type ChannelPermissionRequest,
  type CoreBlowChannelMode,
} from "./channel-shared.js";
import { getChannelMcpCapabilities, registerChannelMcpTools } from "./channel-tools.js";

export { CoreBlowChannelBridge } from "./channel-bridge.js";

export type CoreBlowMcpServeOptions = {
  gatewayUrl?: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  config?: CoreBlowConfig;
  channelMode?: CoreBlowChannelMode;
  verbose?: boolean;
};

export async function createCoreBlowChannelMcpServer(opts: CoreBlowMcpServeOptions = {}): Promise<{
  server: McpServer;
  bridge: CoreBlowChannelBridge;
  start: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const cfg = opts.config ?? loadConfig();
  const channelMode = opts.channelMode ?? "auto";
  const capabilities = getChannelMcpCapabilities(channelMode);
  const server = new McpServer(
    { name: "coreblow", version: VERSION },
    capabilities ? { capabilities } : undefined,
  );
  const bridge = new CoreBlowChannelBridge(cfg, {
    gatewayUrl: opts.gatewayUrl,
    gatewayToken: opts.gatewayToken,
    gatewayPassword: opts.gatewayPassword,
    channelMode,
    verbose: opts.verbose ?? false,
  });
  bridge.setServer(server);

  const permissionHandler = async ({ params }: { params: { request_id: string; tool_name: string; description: string; input_preview: string } }) => {
    await bridge.handleChannelPermissionRequest({
      requestId: params.request_id,
      toolName: params.tool_name,
      description: params.description,
      inputPreview: params.input_preview,
    });
  };
  server.server.setNotificationHandler(ChannelPermissionRequestSchema, permissionHandler);
  registerChannelMcpTools(server, bridge);

  return {
    server,
    bridge,
    start: async () => {
      await bridge.start();
    },
    close: async () => {
      await bridge.close();
      await server.close();
    },
  };
}

export async function serveCoreBlowChannelMcp(opts: CoreBlowMcpServeOptions = {}): Promise<void> {
  const { server, start, close } = await createCoreBlowChannelMcpServer(opts);
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdin.off("end", shutdown);
    process.stdin.off("close", shutdown);
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    transport["onclose"] = undefined;
    void close()
      .catch(() => {})
      .finally(resolveClosed);
  };

  transport["onclose"] = shutdown;
  process.stdin.once("end", shutdown);
  process.stdin.once("close", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    await server.connect(transport);
    await start();
    await closed;
  } finally {
    shutdown();
    await closed;
  }
}
