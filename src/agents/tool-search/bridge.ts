import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  buildCompactToolListing,
  buildStatelessToolCatalog,
  DEFAULT_TOOL_SEARCH_CORE_TOOLS,
  estimateToolSchemaTokens,
  searchToolCatalog,
  TOOL_SEARCH_BRIDGE_NAMES,
  type ToolSearchCatalog,
  type ToolSearchListingTier,
} from "./catalog.js";

export type ToolSearchRbacAuthorizer = (params: {
  toolName: string;
  args: Record<string, unknown>;
}) => Promise<void> | void;

export type ToolSearchAssemblyResult = {
  activated: boolean;
  tools: AgentTool[];
  catalog: ToolSearchCatalog;
  catalogListing: string;
  listingTier?: ToolSearchListingTier;
  eagerTokensEstimate: number;
  visibleTokensEstimate: number;
};

const ToolSearchParamsSchema = Type.Object({
  query: Type.String({ description: "Keyword query describing the tool or capability to find." }),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of matching tools to return (1-25)." }),
  ),
});

const ToolDescribeParamsSchema = Type.Object({
  names: Type.Array(Type.String(), {
    description: "One or more deferred tool names to inspect parameter schemas for.",
  }),
});

const ToolCallParamsSchema = Type.Object({
  name: Type.String({ description: "Exact name of the deferred tool to invoke." }),
  arguments: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: "JSON arguments object matching the tool schema from tool_describe.",
    }),
  ),
});

function formatJsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function createToolSearchBridgeTools(params: {
  catalog: ToolSearchCatalog;
  authorizeToolCall?: ToolSearchRbacAuthorizer;
}): AgentTool[] {
  const { catalog, authorizeToolCall } = params;

  const toolSearch: AgentTool<typeof ToolSearchParamsSchema> = {
    name: "tool_search",
    label: "Tool Search",
    description:
      "Search deferred CoreBlow tools by keyword and return matching tool names with compact summaries.",
    parameters: ToolSearchParamsSchema,
    execute: async (_toolCallId, args) => {
      const query = typeof args.query === "string" ? args.query : "";
      const limit = typeof args.limit === "number" ? args.limit : 8;
      const matches = searchToolCatalog(catalog, query, limit).map((entry) => ({
        name: entry.name,
        summary: entry.summary,
      }));
      return formatJsonResult({
        query,
        totalDeferred: catalog.entries.length,
        matches,
      });
    },
  };

  const toolDescribe: AgentTool<typeof ToolDescribeParamsSchema> = {
    name: "tool_describe",
    label: "Tool Describe",
    description:
      "Return full descriptions and JSON parameter schemas for one or more deferred tools before calling them via tool_call.",
    parameters: ToolDescribeParamsSchema,
    execute: async (_toolCallId, args) => {
      const requested = Array.isArray(args.names) ? args.names.slice(0, 10) : [];
      const tools = requested.map((rawName: unknown) => {
        const name = String(rawName).trim();
        const entry = catalog.byName.get(name);
        if (!entry) {
          return { name, found: false, error: `Deferred tool "${name}" is not available.` };
        }
        return {
          name: entry.name,
          found: true,
          description: entry.description,
          parameters: entry.parameters,
        };
      });
      return formatJsonResult({ tools });
    },
  };

  const toolCall: AgentTool<typeof ToolCallParamsSchema> = {
    name: "tool_call",
    label: "Tool Call",
    description:
      "Invoke a deferred tool by exact name with its JSON arguments. Enforces active tool policy, approvals, and RBAC.",
    parameters: ToolCallParamsSchema,
    execute: async (toolCallId, args, signal, onUpdate) => {
      const toolName = typeof args.name === "string" ? args.name.trim() : "";
      if (!toolName) {
        throw new Error("tool_call requires a non-empty tool name.");
      }
      if ((TOOL_SEARCH_BRIDGE_NAMES as readonly string[]).includes(toolName)) {
        throw new Error(`tool_call cannot recursively invoke bridge tool "${toolName}".`);
      }
      const entry = catalog.byName.get(toolName);
      if (!entry) {
        throw new Error(`Tool "${toolName}" is not registered or is blocked by active policy.`);
      }
      const toolArgs =
        args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments)
          ? args.arguments
          : {};
      if (authorizeToolCall) {
        await authorizeToolCall({ toolName, args: toolArgs });
      }
      return await entry.tool.execute(toolCallId, toolArgs as never, signal, onUpdate);
    },
  };

  return [toolSearch, toolDescribe, toolCall];
}

/**
 * Applies stateless cache-preserving Tool Search assembly over a live tool array.
 * Keeps the model-visible `tools` array immutable across turns while deferring long-tail schemas.
 */
export function applyToolSearchAssembly(params: {
  tools: ReadonlyArray<AgentTool>;
  config?: CoreBlowConfig;
  provider?: string;
  modelId?: string;
  contextWindowTokens?: number;
  authorizeToolCall?: ToolSearchRbacAuthorizer;
}): ToolSearchAssemblyResult {
  const cfg = params.config?.agents?.defaults?.toolSearch;
  const enabledSetting = cfg?.enabled ?? "auto";
  const threshold = Math.max(1, cfg?.threshold ?? 12);
  const eagerTokensEstimate = estimateToolSchemaTokens(params.tools);

  const coreSet = new Set<string>([
    ...DEFAULT_TOOL_SEARCH_CORE_TOOLS,
    ...(cfg?.coreTools ?? []).map((name) => name.trim()).filter(Boolean),
  ]);

  const coreTools: AgentTool[] = [];
  const deferredTools: AgentTool[] = [];
  for (const tool of params.tools) {
    if ((TOOL_SEARCH_BRIDGE_NAMES as readonly string[]).includes(tool.name)) {
      continue;
    }
    if (coreSet.has(tool.name)) {
      coreTools.push(tool);
    } else {
      deferredTools.push(tool);
    }
  }

  const shouldActivate =
    enabledSetting === false
      ? false
      : enabledSetting === true
        ? deferredTools.length > 0
        : deferredTools.length > 0 && params.tools.length > threshold;

  if (!shouldActivate) {
    return {
      activated: false,
      tools: [...params.tools],
      catalog: buildStatelessToolCatalog([]),
      catalogListing: "",
      eagerTokensEstimate,
      visibleTokensEstimate: eagerTokensEstimate,
    };
  }

  const catalog = buildStatelessToolCatalog(deferredTools);
  const bridgeTools = createToolSearchBridgeTools({
    catalog,
    authorizeToolCall: params.authorizeToolCall,
  });
  const modelVisibleTools = [...coreTools, ...bridgeTools];
  const listing = buildCompactToolListing({
    catalog,
    contextWindowTokens: params.contextWindowTokens,
    thresholdPct: cfg?.thresholdPct,
    listingMaxTokens: cfg?.listingMaxTokens,
  });

  return {
    activated: true,
    tools: modelVisibleTools,
    catalog,
    catalogListing: listing.text,
    listingTier: listing.tier,
    eagerTokensEstimate,
    visibleTokensEstimate: estimateToolSchemaTokens(modelVisibleTools),
  };
}
