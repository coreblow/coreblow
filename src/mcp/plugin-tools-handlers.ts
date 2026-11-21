import {
  isToolWrappedWithBeforeToolCallHook,
  wrapToolWithBeforeToolCallHook,
} from "../agents/pi-tools.before-tool-call.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { stringifyToolPayload } from "../agents/tools/common.js";
import { formatErrorMessage } from "../infra/errors.js";

type CallPluginToolParams = {
  name: string;
  arguments?: unknown;
};

function resolveJsonSchemaForTool(tool: AnyAgentTool): Record<string, unknown> {
  const params = tool.parameters;
  if (params && typeof params === "object" && "type" in params) {
    return params as Record<string, unknown>;
  }
  return { type: "object", properties: {} };
}

export function createPluginToolsMcpHandlers(tools: AnyAgentTool[]) {
  const allowedTools = tools.filter((tool) => !tool.ownerOnly);
  const wrappedTools = allowedTools.map((tool) => {
    if (isToolWrappedWithBeforeToolCallHook(tool)) {
      return tool;
    }
    return wrapToolWithBeforeToolCallHook(tool);
  });
  const toolMap = new Map<string, AnyAgentTool>();
  const toolDescriptors: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [];

  for (const tool of wrappedTools) {
    let name = tool.name;
    if (toolMap.has(name)) {
      const pluginId = (tool as any).pluginId || (tool as any).plugin?.id || "plugin";
      const namespacedName = `${pluginId}__${name}`;
      console.warn(`[coreblow] Warning: MCP tool collision detected for "${name}". Registering as "${namespacedName}".`);
      name = namespacedName;
    }
    toolMap.set(name, tool);
    toolDescriptors.push({
      name,
      description: tool.description ?? "",
      inputSchema: resolveJsonSchemaForTool(tool),
    });
  }

  return {
    listTools: async () => ({
      tools: toolDescriptors,
    }),
    callTool: async (params: CallPluginToolParams, signal?: AbortSignal) => {
      const tool = toolMap.get(params.name);
      if (!tool) {
        return {
          content: [{ type: "text", text: `Unknown tool: ${params.name}` }],
          isError: true,
        };
      }
      try {
        const result = await tool.execute(`mcp-${Date.now()}`, params.arguments ?? {}, signal);
        const rawContent =
          result && typeof result === "object" && "content" in result
            ? (result as { content?: unknown }).content
            : result;
        return {
          content: Array.isArray(rawContent)
            ? rawContent
            : [{ type: "text", text: stringifyToolPayload(rawContent) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Tool error: ${formatErrorMessage(err)}` }],
          isError: true,
        };
      }
    },
  };
}
