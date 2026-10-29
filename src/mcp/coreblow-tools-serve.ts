import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

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
