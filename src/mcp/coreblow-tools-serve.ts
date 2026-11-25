import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { COREBLOW_OPENAI_TOOLS, CoreBlowToolExecutor } from "../agents/coreblow-react-engine.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { VERSION } from "../version.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

const SOVEREIGN_NATIVE_TOOL_NAMES = new Set<string>(
  COREBLOW_OPENAI_TOOLS.map((entry) => entry.function.name),
);

export function createSovereignNativeMcpServer(
  executor: CoreBlowToolExecutor = new CoreBlowToolExecutor(),
): Server {
  const server = new Server(
    { name: "coreblow", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: COREBLOW_OPENAI_TOOLS.map((entry) => ({
      name: entry.function.name,
      description: entry.function.description,
      inputSchema: entry.function.parameters,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    if (!SOVEREIGN_NATIVE_TOOL_NAMES.has(toolName)) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }
    const rawArgs = request.params.arguments;
    const args =
      rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
        ? (rawArgs as Record<string, unknown>)
        : {};
    const result = await executor.executeTool(toolName, args, "Full access", process.cwd());
    const text =
      result.output && result.output.length > 0
        ? result.output
        : (result.error ?? (result.success ? "ok" : "Tool execution failed."));
    return {
      content: [{ type: "text" as const, text }],
      isError: !result.success,
    };
  });

  return server;
}

export async function serveSovereignNativeMcp(): Promise<void> {
  const server = createSovereignNativeMcpServer();
  await connectToolsMcpServerToStdio(server);
}

export function resolveCoreBlowToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

export function createCoreBlowToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveCoreBlowToolsForMcp();
  return createToolsMcpServer({ name: "coreblow-tools", tools });
}

export async function serveCoreBlowToolsMcp(): Promise<void> {
  const server = createCoreBlowToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveCoreBlowToolsMcp().catch((err) => {
    process.stderr.write(`coreblow-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}

export {
  createSovereignMicrokernelMcpTools,
  executeSovereignMcpJsonRpc,
  type SovereignMcpBridgeOptions,
  type SovereignMcpToolsResult,
  type ExecuteSovereignMcpJsonRpcParams,
} from "./sovereign-mcp-bridge.js";
