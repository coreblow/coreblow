import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { pickSandboxToolPolicy } from "../agents/sandbox-tool-policy.js";
import {
  collectExplicitAllowlist,
  collectExplicitDenylist,
  mergeAlsoAllowPolicy,
  resolveToolProfilePolicy,
} from "../agents/tool-policy.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { loadConfig, type CoreBlowConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import { routeLogsToStderr } from "../logging/console.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

function resolvePluginToolPolicy(config: CoreBlowConfig): {
  toolAllowlist?: string[];
  toolDenylist?: string[];
} {
  const profilePolicy = mergeAlsoAllowPolicy(
    resolveToolProfilePolicy(config.tools?.profile),
    config.tools?.alsoAllow,
  );
  const globalPolicy = pickSandboxToolPolicy(config.tools);
  const toolAllowlist = collectExplicitAllowlist([profilePolicy, globalPolicy]);
  const toolDenylist = collectExplicitDenylist([profilePolicy, globalPolicy]);
  return {
    ...(toolAllowlist.length > 0 ? { toolAllowlist } : {}),
    ...(toolDenylist.length > 0 ? { toolDenylist } : {}),
  };
}

function resolveTools(config: CoreBlowConfig): AnyAgentTool[] {
  const pluginToolPolicy = resolvePluginToolPolicy(config);
  return resolvePluginTools({
    context: { config },
    ...pluginToolPolicy,
    suppressNameConflicts: true,
  });
}

export function createPluginToolsMcpServer(
  params: {
    config?: CoreBlowConfig;
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const cfg = params.config ?? loadConfig();
  const tools = params.tools ?? resolveTools(cfg);
  return createToolsMcpServer({ name: "coreblow-plugin-tools", tools });
}

export async function servePluginToolsMcp(): Promise<void> {
  routeLogsToStderr();

  const config = loadConfig();
  const tools = resolveTools(config);
  const server = createPluginToolsMcpServer({ config, tools });
  if (tools.length === 0) {
    process.stderr.write("plugin-tools-serve: no plugin tools found\n");
  }

  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  servePluginToolsMcp().catch((err) => {
    process.stderr.write(`plugin-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
