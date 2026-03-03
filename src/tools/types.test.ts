import { describe, expect, it } from "vitest";
import type { ToolHandler } from "./types.js";

describe("ToolHandler interface contract", () => {
  it("accepts a valid ToolHandler object", () => {
    const handler: ToolHandler = {
      name: "calculator",
      description: "Performs arithmetic",
      parameters: { a: { type: "number" }, b: { type: "number" } },
      execute: async (args) => String(Number(args.a) + Number(args.b)),
    };
    expect(handler.name).toBe("calculator");
    expect(typeof handler.execute).toBe("function");
  });

  it("execute returns a string Promise", async () => {
    const handler: ToolHandler = {
      name: "echo",
      description: "Echoes input",
      parameters: { text: { type: "string" } },
      execute: async (args) => String(args.text),
    };
    const result = await handler.execute({ text: "hello" });
    expect(typeof result).toBe("string");
    expect(result).toBe("hello");
  });

  it("parameters is a Record<string, unknown>", () => {
    const handler: ToolHandler = {
      name: "test",
      description: "Test tool",
      parameters: { x: { type: "number", required: true }, y: "optional" },
      execute: async () => "ok",
    };
    expect(typeof handler.parameters).toBe("object");
  });

  it("name is a non-empty string", () => {
    const handler: ToolHandler = {
      name: "my-tool",
      description: "desc",
      parameters: {},
      execute: async () => "done",
    };
    expect(handler.name.length).toBeGreaterThan(0);
  });

  it("description is a non-empty string", () => {
    const handler: ToolHandler = {
      name: "t",
      description: "Some description",
      parameters: {},
      execute: async () => "ok",
    };
    expect(handler.description.length).toBeGreaterThan(0);
  });
});
