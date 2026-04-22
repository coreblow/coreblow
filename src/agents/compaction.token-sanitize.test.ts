/**
 * src/agents/compaction.token-sanitize.test.ts
 *
 * CoreBlow — Compaction Token & Message Pruning Tests
 * Verifies token estimation and token-aware compaction logic.
 * Pure-function tests — no external AI or network dependencies.
 */
import { describe, expect, it } from "vitest";
import type { CompactionMessage } from "./compaction.js";
import {
  chunkMessagesByMaxTokens,
  estimateMessagesTokens,
  estimateTokens,
  isOversizedForSummary,
  splitMessagesByTokenShare,
} from "./compaction.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function msg(role: "user" | "assistant", text: string): CompactionMessage {
  return { role, content: [{ type: "text", text }] };
}

function repeat(ch: string, n: number) {
  return ch.repeat(n);
}

// ── estimateTokens ───────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("returns positive number for non-empty text", () => {
    const result = estimateTokens(msg("user", "hello world"));
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 or positive for empty text", () => {
    const result = estimateTokens(msg("user", ""));
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("longer text produces higher token count", () => {
    const short = estimateTokens(msg("user", "hi"));
    const long = estimateTokens(msg("user", repeat("a", 1000)));
    expect(long).toBeGreaterThan(short);
  });

  it("is consistent for same input", () => {
    const a = estimateTokens(msg("user", "test message"));
    const b = estimateTokens(msg("user", "test message"));
    expect(a).toBe(b);
  });
});

// ── estimateMessagesTokens ────────────────────────────────────────────────────

describe("estimateMessagesTokens", () => {
  it("returns 0 for empty array", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it("sums up token counts across messages", () => {
    const msgs = [msg("user", "hello"), msg("assistant", "world")];
    const total = estimateMessagesTokens(msgs);
    const sum = msgs.reduce((acc, m) => acc + estimateTokens(m), 0);
    expect(total).toBe(sum);
  });

  it("grows with more messages", () => {
    const one = estimateMessagesTokens([msg("user", "hello")]);
    const two = estimateMessagesTokens([msg("user", "hello"), msg("assistant", "world")]);
    expect(two).toBeGreaterThan(one);
  });
});

// ── isOversizedForSummary ─────────────────────────────────────────────────────

describe("isOversizedForSummary", () => {
  it("returns false for small messages in large context", () => {
    const m = msg("user", "short message");
    expect(isOversizedForSummary(m, 100_000)).toBe(false);
  });

  it("returns true for very large message relative to context", () => {
    const bigText = repeat("word ", 50_000);
    const m = msg("user", bigText);
    expect(isOversizedForSummary(m, 1_000)).toBe(true);
  });
});

// ── splitMessagesByTokenShare ─────────────────────────────────────────────────

describe("splitMessagesByTokenShare", () => {
  it("splits messages into parts", () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      msg("user", `message ${i}`),
    );
    const parts = splitMessagesByTokenShare(msgs, 2);
    expect(parts.length).toBe(2);
    expect(parts[0].length + parts[1].length).toBe(msgs.length);
  });

  it("returns empty array or single part for empty messages", () => {
    const parts = splitMessagesByTokenShare([], 2);
    // CB returns [] for empty input (correct behavior)
    expect(Array.isArray(parts)).toBe(true);
  });
});

// ── chunkMessagesByMaxTokens ──────────────────────────────────────────────────

describe("chunkMessagesByMaxTokens", () => {
  it("returns single chunk when total is under limit", () => {
    const msgs = [msg("user", "hi"), msg("assistant", "hello")];
    const chunks = chunkMessagesByMaxTokens(msgs, 100_000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toHaveLength(msgs.length);
  });

  it("splits into multiple chunks when over limit", () => {
    const bigText = repeat("x", 10_000);
    const msgs = Array.from({ length: 20 }, () => msg("user", bigText));
    const chunks = chunkMessagesByMaxTokens(msgs, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("every message appears in exactly one chunk", () => {
    const msgs = Array.from({ length: 6 }, (_, i) => msg("user", `message ${i}`));
    const chunks = chunkMessagesByMaxTokens(msgs, 5);
    const allMsgs = chunks.flat();
    expect(allMsgs.length).toBe(msgs.length);
  });
});
