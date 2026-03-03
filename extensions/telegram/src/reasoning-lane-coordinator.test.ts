/**
 * extensions/telegram/src/reasoning-lane-coordinator.test.ts
 *
 * CoreBlow — Telegram Extension: Reasoning-lane-coordinator Tests
 * Verifies Reasoning lane coordination and routing.
 */
import { describe, expect, it } from "vitest";
import { splitTelegramReasoningText } from "./reasoning-lane-coordinator.js";

describe("splitTelegramReasoningText", () => {
  it("splits real tagged reasoning and answer", () => {
    expect(splitTelegramReasoningText("<think>example</think>Done")).toEqual({
      reasoningText: "Reasoning:\n_example_",
      answerText: "Done",
    });
  });

  it("ignores literal think tags inside inline code", () => {
    const text = "Use `<think>example</think>` literally.";
    expect(splitTelegramReasoningText(text)).toEqual({
      answerText: text,
    });
  });

  it("ignores literal think tags inside fenced code blocks", () => {
    const text = "```xml\n<think>example</think>\n```";
    expect(splitTelegramReasoningText(text)).toEqual({
      answerText: text,
    });
  });

  it("does not emit partial reasoning tag prefixes", () => {
    expect(splitTelegramReasoningText("  <thi")).toEqual({});
  });

  it("handles undefined input", () => {
    const result = splitTelegramReasoningText(undefined);
    expect(result).toEqual({});
  });

  it("handles empty string", () => {
    const result = splitTelegramReasoningText("");
    // Empty string returns answerText: '' (treated as pass-through, not undefined)
    expect(result.answerText).toBe("");
    expect(result.reasoningText).toBeUndefined();
  });

  it("handles text with no reasoning tags (passes through as answerText)", () => {
    const result = splitTelegramReasoningText("Just a normal response.");
    expect(result.answerText).toBe("Just a normal response.");
    expect(result.reasoningText).toBeUndefined();
  });

  it("handles nested thinking tag variants", () => {
    const result = splitTelegramReasoningText("<thinking>deep thought</thinking>Answer here");
    expect(result.answerText).toBe("Answer here");
    expect(result.reasoningText).toContain("deep thought");
  });
});
