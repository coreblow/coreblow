import { describe, expect, it } from "vitest";
import {
  createLmstudioSyntheticToolCallId,
  parseLmstudioPlainTextToolCalls,
} from "./plain-text-tool-calls.js";

describe("lmstudio plain text tool calls", () => {
  it("parses standalone bracketed tool requests for allowed tools", () => {
    const parsed = parseLmstudioPlainTextToolCalls(
      ["[mempalace_search]", '{"query":"codename"}', "[END_TOOL_REQUEST]"].join("\n"),
      new Set(["mempalace_search"]),
    );

    expect(parsed).toEqual([
      {
        name: "mempalace_search",
        arguments: { query: "codename" },
      },
    ]);
  });

  it("rejects surrounding text and disallowed tools", () => {
    expect(
      parseLmstudioPlainTextToolCalls(
        "before\n[read]\n{\"path\":\"x\"}\n[END_TOOL_REQUEST]",
        new Set(["read"]),
      ),
    ).toBeNull();
    expect(
      parseLmstudioPlainTextToolCalls(
        ["[write]", '{"path":"x"}', "[END_TOOL_REQUEST]"].join("\n"),
        new Set(["read"]),
      ),
    ).toBeNull();
  });

  it("creates OpenAI-style synthetic call ids", () => {
    expect(createLmstudioSyntheticToolCallId()).toMatch(/^call_[a-f0-9]{24}$/u);
  });
});
