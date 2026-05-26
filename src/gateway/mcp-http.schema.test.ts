import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpLoopbackTool } from "./mcp-http.schema.js";
import { buildMcpToolSchema } from "./mcp-http.schema.js";

const logWarnMock = vi.hoisted(() => vi.fn());

vi.mock("../logger.js", () => ({
  logWarn: logWarnMock,
}));

function createTool(parameters?: Record<string, unknown>): McpLoopbackTool {
  return {
    name: "demo",
    label: "demo",
    description: "Demo tool",
    parameters,
    execute: vi.fn(),
  } as unknown as McpLoopbackTool;
}

describe("MCP loopback tool schema", () => {
  beforeEach(() => {
    logWarnMock.mockClear();
  });

  it("normalizes tools without object parameters to an MCP object schema", () => {
    expect(buildMcpToolSchema([createTool(undefined)])).toEqual([
      {
        name: "demo",
        description: "Demo tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
  });

  it("flattens union schemas and keeps only shared required properties", () => {
    const [entry] = buildMcpToolSchema([
      createTool({
        anyOf: [
          {
            type: "object",
            properties: {
              action: { const: "read" },
              path: { type: "string" },
            },
            required: ["action", "path"],
          },
          {
            type: "object",
            properties: {
              action: { const: "write" },
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["action", "path", "content"],
          },
        ],
      }),
    ]);

    expect(entry.inputSchema).toEqual({
      type: "object",
      properties: {
        action: { enum: ["read", "write"] },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["action", "path"],
    });
  });

  it("keeps the first incompatible property schema and logs the conflict", () => {
    const [entry] = buildMcpToolSchema([
      createTool({
        oneOf: [
          { properties: { value: { type: "string" } } },
          { properties: { value: { type: "number" } } },
        ],
      }),
    ]);

    expect(entry.inputSchema.properties).toEqual({ value: { type: "string" } });
    expect(logWarnMock).toHaveBeenCalledWith(
      'mcp loopback: conflicting schema definitions for "value", keeping the first variant',
    );
  });
});
