import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

type ToolExecute = ReturnType<typeof toToolDefinitions>[number]["execute"];
const extensionContext = {} as Parameters<ToolExecute>[4];

function createTool(): AgentTool {
  return {
    name: "bash",
    label: "Bash",
    description: "runs",
    parameters: Type.Object({}),
    execute: vi.fn(async () => ({
      content: [{ type: "text" as const, text: "raw output" }],
      details: { status: "ok" },
    })),
  } satisfies AgentTool;
}

async function executeTool(tool: AgentTool, params: Record<string, unknown>) {
  const def = toToolDefinitions([tool])[0];
  if (!def) {
    throw new Error("missing tool definition");
  }
  return await def.execute("call-1", params, undefined, undefined, extensionContext);
}

describe("pi tool definition adapter tool result middleware", () => {
  beforeEach(() => {
    setActivePluginRegistry(createEmptyPluginRegistry());
  });

  it("runs registered Pi tool result middleware after tool execution", async () => {
    const registry = createEmptyPluginRegistry();
    const middleware = vi.fn(async (event) => ({
      result: {
        ...event.result,
        content: [{ type: "text" as const, text: "compacted" }],
        details: { ...event.result.details, compacted: true },
      },
    }));
    registry.agentToolResultMiddlewares.push({
      pluginId: "tokenjuice",
      source: "test",
      middleware,
      runtimes: ["pi"],
    });
    setActivePluginRegistry(registry);

    const result = await executeTool(createTool(), { command: "ls", workdir: "/tmp/work" });

    expect(middleware).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: "pi",
        toolName: "exec",
        args: { command: "ls", workdir: "/tmp/work" },
        cwd: "/tmp/work",
        isError: false,
      }),
    );
    expect(result.content).toEqual([{ type: "text", text: "compacted" }]);
    expect(result.details).toMatchObject({ status: "ok", compacted: true });
  });

  it("skips middleware registered for another runtime", async () => {
    const registry = createEmptyPluginRegistry();
    const middleware = vi.fn();
    registry.agentToolResultMiddlewares.push({
      pluginId: "codex-only",
      source: "test",
      middleware,
      runtimes: ["codex"],
    });
    setActivePluginRegistry(registry);

    const result = await executeTool(createTool(), { command: "ls" });

    expect(middleware).not.toHaveBeenCalled();
    expect(result.content).toEqual([{ type: "text", text: "raw output" }]);
  });
});
