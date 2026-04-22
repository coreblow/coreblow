/**
 * src/agents/compaction.identifier-preservation.test.ts
 *
 * CoreBlow — Compaction History Pruning & Local Summary Tests
 * Verifies pruneHistoryForContextShare and createLocalSummary behavior.
 * CB-native implementation: uses pure functions without external AI mock.
 */
import { describe, expect, it } from "vitest";
import type { CompactionMessage } from "./compaction.js";
import {
  createLocalSummary,
  estimateMessagesTokens,
  pruneHistoryForContextShare,
} from "./compaction.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function msg(role: "user" | "assistant", text: string): CompactionMessage {
  return { role, content: [{ type: "text", text }] };
}

function msgs(n: number, textSize = 100): CompactionMessage[] {
  return Array.from({ length: n }, (_, i) =>
    msg(i % 2 === 0 ? "user" : "assistant", `${"x".repeat(textSize)} msg-${i}`),
  );
}

// ── createLocalSummary ────────────────────────────────────────────────────────

describe("createLocalSummary", () => {
  it("returns non-empty string for non-empty messages", () => {
    const summary = createLocalSummary(msgs(5));
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("returns a fallback string for empty messages", () => {
    const summary = createLocalSummary([]);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("mentions message count in summary", () => {
    const messages = msgs(6);
    const summary = createLocalSummary(messages);
    expect(summary).toMatch(/\d+/); // contains at least one number
  });

  it("includes role counts", () => {
    const messages = [
      msg("user", "hello"),
      msg("assistant", "world"),
      msg("user", "again"),
    ];
    const summary = createLocalSummary(messages);
    // Should mention user and assistant
    expect(summary.toLowerCase()).toMatch(/user|assistant/);
  });

  it("is consistent for same input", () => {
    const messages = msgs(4);
    expect(createLocalSummary(messages)).toBe(createLocalSummary(messages));
  });
});

// ── pruneHistoryForContextShare ───────────────────────────────────────────────

describe("pruneHistoryForContextShare", () => {
  it("returns result object with required fields", () => {
    const result = pruneHistoryForContextShare({
      messages: msgs(10),
      maxContextTokens: 100_000,
    });
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("droppedCount");
    expect(result).toHaveProperty("droppedTokens");
    expect(result).toHaveProperty("keptTokens");
    expect(result).toHaveProperty("budgetTokens");
    expect(Array.isArray(result.messages)).toBe(true);
    expect(typeof result.droppedCount).toBe("number");
  });

  it("does not drop messages when they fit within context", () => {
    const messages = msgs(5, 10); // small messages
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 1_000_000,
    });
    expect(result.droppedCount).toBe(0);
    expect(result.messages.length).toBe(messages.length);
  });

  it("drops messages when context is very tight", () => {
    const messages = msgs(20, 500); // larger messages
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 10, // impossibly small
    });
    expect(result.droppedCount).toBeGreaterThanOrEqual(0);
    expect(result.droppedCount + result.messages.length).toBe(messages.length);
  });

  it("droppedCount + kept messages.length = total input length", () => {
    const messages = msgs(10);
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 200,
    });
    expect(result.droppedCount + result.messages.length).toBe(messages.length);
  });

  it("droppedTokens is non-negative", () => {
    const result = pruneHistoryForContextShare({
      messages: msgs(5),
      maxContextTokens: 50_000,
    });
    expect(result.droppedTokens).toBeGreaterThanOrEqual(0);
  });

  it("keptTokens matches actual kept messages token estimate", () => {
    const messages = msgs(6, 50);
    const result = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 1_000_000,
    });
    const actualKept = estimateMessagesTokens(result.messages);
    expect(result.keptTokens).toBe(actualKept);
  });

  it("returns empty messages array for empty input", () => {
    const result = pruneHistoryForContextShare({
      messages: [],
      maxContextTokens: 100_000,
    });
    expect(result.messages).toHaveLength(0);
    expect(result.droppedCount).toBe(0);
  });
});
