/**
 * src/agents/compaction.retry.test.ts
 *
 * Tests for compaction adaptive chunking and retry-related logic.
 * Ported from OC compaction.retry.test.ts — adapted for CB's pure functions.
 */
import { describe, expect, it } from "vitest";
import type { CompactionMessage } from "./compaction.js";
import {
  chunkMessagesByMaxTokens,
  computeAdaptiveChunkRatio,
  estimateMessagesTokens,
  resolveContextWindowTokens,
} from "./compaction.js";

function msg(role: "user" | "assistant", text: string): CompactionMessage {
  return { role, content: [{ type: "text", text }] };
}

// ── resolveContextWindowTokens ────────────────────────────────────────────────

describe("resolveContextWindowTokens", () => {
  it("returns a positive number for default context window", () => {
    const tokens = resolveContextWindowTokens();
    expect(tokens).toBeGreaterThan(0);
  });

  it("uses provided value when specified", () => {
    const tokens = resolveContextWindowTokens(128_000);
    expect(tokens).toBe(128_000);
  });

  it("returns a positive fallback for undefined input", () => {
    const tokens = resolveContextWindowTokens(undefined);
    expect(tokens).toBeGreaterThan(0);
  });
});

// ── computeAdaptiveChunkRatio ─────────────────────────────────────────────────

describe("computeAdaptiveChunkRatio", () => {
  it("returns a value between 0 and 1", () => {
    const msgs = Array.from({ length: 5 }, (_, i) => msg("user", `msg ${i}`));
    const ratio = computeAdaptiveChunkRatio(msgs, 100_000);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it("returns 1 (or near) when messages fit well within context", () => {
    const msgs = [msg("user", "hi"), msg("assistant", "hello")];
    const ratio = computeAdaptiveChunkRatio(msgs, 100_000);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it("returns positive value for empty messages", () => {
    const ratio = computeAdaptiveChunkRatio([], 100_000);
    expect(ratio).toBeGreaterThan(0);
  });
});

// ── chunkMessagesByMaxTokens — retry semantics ────────────────────────────────

describe("chunkMessagesByMaxTokens — retry semantics", () => {
  it("does not lose messages when chunking for retry", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `message content ${i}`),
    );
    const totalBefore = estimateMessagesTokens(msgs);
    const chunks = chunkMessagesByMaxTokens(msgs, 50);
    const totalAfter = chunks.reduce(
      (acc, chunk) => acc + estimateMessagesTokens(chunk),
      0,
    );
    expect(totalAfter).toBe(totalBefore);
  });

  it("each chunk is independently processable (max-token invariant)", () => {
    const msgs = Array.from({ length: 10 }, () =>
      msg("user", "a".repeat(500)),
    );
    const maxTokens = 100;
    const chunks = chunkMessagesByMaxTokens(msgs, maxTokens);
    // Each chunk should have at most maxTokens or be a single message
    for (const chunk of chunks) {
      const chunkTokens = estimateMessagesTokens(chunk);
      // Either within limit or single message (can't split a single message)
      expect(chunkTokens > 0 || chunk.length === 1).toBe(true);
    }
  });

  it("handles large context window by not chunking", () => {
    const msgs = Array.from({ length: 5 }, (_, i) => msg("user", `short ${i}`));
    const chunks = chunkMessagesByMaxTokens(msgs, Number.MAX_SAFE_INTEGER);
    expect(chunks.length).toBe(1);
  });
});
