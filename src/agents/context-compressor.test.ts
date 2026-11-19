import { describe, expect, it } from "vitest";
import {
  applyPromptCacheControl,
  compressConversationIfNeeded,
  estimateTotalTokens,
  isContextLengthExceededError,
  type ContextMessage,
} from "./context-compressor.js";

describe("context-compressor", () => {
  it("estimates token usage deterministically", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "You are CoreBlow autonomous assistant." },
      { role: "user", content: "List all repository files." },
    ];
    const tokens = estimateTotalTokens(messages);
    expect(tokens).toBeGreaterThan(15);
    expect(tokens).toBeLessThan(40);
  });

  it("does not compress when tokens are below threshold", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "Short system prompt." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];
    const result = compressConversationIfNeeded(messages, { maxContextTokens: 10_000 });
    expect(result.compressed).toBe(false);
    expect(result.messages).toHaveLength(3);
  });

  it("compresses middle turns while preserving system prompt and recent 8 turns", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "Pinned system prompt with dialectic rules." },
    ];

    // Generate 14 turns (6 middle turns + 8 recent turns)
    for (let i = 1; i <= 6; i++) {
      messages.push({
        role: "user",
        content: `User intermediate turn ${i}`,
      });
      messages.push({
        role: "tool",
        tool_call_id: `call_${i}`,
        content: `Extremely long tool execution output for step ${i}. `.repeat(40), // > 600 chars
      });
    }

    for (let i = 7; i <= 10; i++) {
      messages.push({ role: "user", content: `Recent user turn ${i}` });
      messages.push({ role: "assistant", content: `Recent assistant response ${i}` });
    }

    expect(messages.length).toBe(1 + 12 + 8); // 21 messages total

    // Force compression with small maxContextTokens limit
    const result = compressConversationIfNeeded(messages, {
      maxContextTokens: 500, // force threshold breach
      preserveRecentCount: 8,
    });

    expect(result.compressed).toBe(true);
    expect(result.savedTokens).toBeGreaterThan(0);

    // Verify system prompt is preserved as first item
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("Pinned system prompt");

    // Verify recent 8 turns are preserved at the end
    const last8 = result.messages.slice(-8);
    expect(last8[last8.length - 1].content).toBe("Recent assistant response 10");
  });

  it("applies ephemeral prompt cache control for Anthropic endpoints", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "System persona block." },
      { role: "user", content: "Hello" },
    ];

    const cached = applyPromptCacheControl(messages, true);
    expect(Array.isArray(cached[0].content)).toBe(true);
    const contentBlocks = cached[0].content as Array<any>;
    expect(contentBlocks[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("detects context length exceeded HTTP errors accurately", () => {
    expect(isContextLengthExceededError(400, "context_length_exceeded: maximum context length is 8192")).toBe(true);
    expect(isContextLengthExceededError(413, "Prompt is too long for the selected model context window")).toBe(true);
    expect(isContextLengthExceededError(400, "Invalid JSON input")).toBe(false);
    expect(isContextLengthExceededError(500, "Internal Server Error")).toBe(false);
  });
});
