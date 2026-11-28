import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import {
  applyToolSearchAssembly,
  buildCompactToolListing,
  buildStatelessToolCatalog,
  estimateToolSchemaTokens,
} from "./index.js";

function makeHeavyTool(name: string, executeImpl?: AgentTool["execute"]): AgentTool {
  const schema = Type.Object({
    target: Type.String({ description: `Target resource identifier for ${name} operation.` }),
    action: Type.String({ description: `Detailed action mode for ${name} execution.` }),
    payload: Type.Optional(
      Type.Record(Type.String(), Type.Unknown(), {
        description: `Structured configuration payload for ${name} with nested options and flags.`,
      }),
    ),
    timeoutMs: Type.Optional(
      Type.Number({ description: `Execution timeout in milliseconds for ${name}.` }),
    ),
    dryRun: Type.Optional(
      Type.Boolean({ description: `Preview changes without mutating state for ${name}.` }),
    ),
  });
  return {
    name,
    label: name,
    description: `Execute ${name} workflows with full schema validation, policy checks, and structured output.`,
    parameters: schema,
    execute:
      executeImpl ??
      (async (_id, args) => ({
        content: [{ type: "text", text: JSON.stringify({ tool: name, args }) }],
        details: { ok: true },
      })),
  };
}

describe("cache-preserving 3-bridge tool search", () => {
  it("reduces input tool-schema tokens by >=60% on 26+ tools while keeping tools array immutable", async () => {
    const core = ["read", "write", "memory_search"];
    const deferred = Array.from({ length: 24 }, (_, idx) => `extended_tool_${idx + 1}`);
    const allTools = [...core, ...deferred].map((name) => makeHeavyTool(name));

    const assemblyTurn1 = applyToolSearchAssembly({
      tools: allTools,
      contextWindowTokens: 131_072,
    });
    expect(assemblyTurn1.activated).toBe(true);
    expect(assemblyTurn1.tools.map((t) => t.name)).toEqual([
      "read",
      "write",
      "memory_search",
      "tool_search",
      "tool_describe",
      "tool_call",
    ]);

    const reduction =
      (assemblyTurn1.eagerTokensEstimate - assemblyTurn1.visibleTokensEstimate) /
      assemblyTurn1.eagerTokensEstimate;
    expect(reduction).toBeGreaterThanOrEqual(0.6);

    // Search + describe + call NEVER mutate the model-visible tools array
    const searchTool = assemblyTurn1.tools.find((t) => t.name === "tool_search")!;
    const describeTool = assemblyTurn1.tools.find((t) => t.name === "tool_describe")!;
    const callTool = assemblyTurn1.tools.find((t) => t.name === "tool_call")!;

    const searchResult = await searchTool.execute("c1", { query: "extended_tool_7", limit: 5 });
    expect((searchResult.details as { matches: Array<{ name: string }> }).matches[0]?.name).toBe(
      "extended_tool_7",
    );

    const describeResult = await describeTool.execute("c2", { names: ["extended_tool_7"] });
    expect((describeResult.details as { tools: Array<{ found: boolean }> }).tools[0]?.found).toBe(
      true,
    );

    const assemblyTurn2 = applyToolSearchAssembly({
      tools: allTools,
      contextWindowTokens: 131_072,
    });
    expect(assemblyTurn2.tools.map((t) => t.name)).toEqual(assemblyTurn1.tools.map((t) => t.name));

    const callResult = await callTool.execute("c3", {
      name: "extended_tool_7",
      arguments: { target: "alpha", action: "run" },
    });
    expect(callResult.content[0]).toMatchObject({ type: "text" });
    expect(estimateToolSchemaTokens(assemblyTurn2.tools)).toBe(assemblyTurn1.visibleTokensEstimate);
  });

  it("enforces policy/RBAC authorization on tool_call and blocks unlisted tools", async () => {
    const blockedExecute = vi.fn();
    const allowedExecute = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "ran" }],
      details: { ran: true },
    }));
    const tools = [
      makeHeavyTool("read"),
      makeHeavyTool("allowed_tool", allowedExecute),
      makeHeavyTool("rbac_denied_tool", blockedExecute),
    ];

    const assembly = applyToolSearchAssembly({
      tools,
      config: { agents: { defaults: { toolSearch: { enabled: true } } } },
      authorizeToolCall: async ({ toolName }) => {
        if (toolName === "rbac_denied_tool") {
          throw new Error("RBAC denied: operator role required");
        }
      },
    });

    const toolCall = assembly.tools.find((t) => t.name === "tool_call")!;
    await expect(
      toolCall.execute("c1", { name: "rbac_denied_tool", arguments: {} }),
    ).rejects.toThrow("RBAC denied");
    expect(blockedExecute).not.toHaveBeenCalled();

    await expect(
      toolCall.execute("c2", { name: "unlisted_secret_tool", arguments: {} }),
    ).rejects.toThrow("not registered");

    await expect(
      toolCall.execute("c3", { name: "tool_call", arguments: {} }),
    ).rejects.toThrow("recursively");

    await toolCall.execute("c4", { name: "allowed_tool", arguments: { target: "x", action: "y" } });
    expect(allowedExecute).toHaveBeenCalledTimes(1);
  });

  it("degrades compact listing across full -> names -> bare tiers within token budget", () => {
    const catalog = buildStatelessToolCatalog(
      Array.from({ length: 40 }, (_, i) => makeHeavyTool(`mcp_server_tool_${i + 1}`)),
    );

    const full = buildCompactToolListing({ catalog, contextWindowTokens: 200_000, thresholdPct: 5 });
    expect(full.tier).toBe("full");

    const names = buildCompactToolListing({ catalog, contextWindowTokens: 16_000, thresholdPct: 2 });
    expect(names.tier).toBe("names");

    const bare = buildCompactToolListing({ catalog, contextWindowTokens: 4_000, thresholdPct: 1 });
    expect(bare.tier).toBe("bare");
    expect(bare.text).toContain("40 deferred tools available");
  });
});
