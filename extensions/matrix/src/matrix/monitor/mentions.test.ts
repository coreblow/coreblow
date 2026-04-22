import { describe, expect, it, vi } from "vitest";

// Mock runtime before importing resolveMentions
vi.mock("../../runtime.js", () => ({
  getMatrixRuntime: () => ({
    channel: {
      mentions: {
        matchesMentionPatterns: (text: string, patterns: RegExp[]) =>
          patterns.some((p) => p.test(text)),
      },
    },
  }),
}));

import { resolveMentions } from "./mentions.js";

describe("resolveMentions", () => {
  const userId = "@bot:matrix.org";
  const mentionRegexes = [/@bot/i];

  it("detects mention via m.mentions.user_ids when visible text also mentions the bot", () => {
    const result = resolveMentions({
      content: {
        msgtype: "m.text",
        body: "hello @bot",
        "m.mentions": { user_ids: ["@bot:matrix.org"] },
      },
      userId,
      text: "hello @bot",
      mentionRegexes,
    });
    expect(result.wasMentioned).toBe(true);
    expect(result.hasExplicitMention).toBe(true);
  });

  it("does not trust forged m.mentions.user_ids without a visible mention", () => {
    const result = resolveMentions({
      content: {
        msgtype: "m.text",
        body: "hello",
        "m.mentions": { user_ids: ["@bot:matrix.org"] },
      },
      userId,
      text: "hello",
      mentionRegexes,
    });
    expect(result.wasMentioned).toBe(false);
    expect(result.hasExplicitMention).toBe(false);
  });

  it("detects room mention via visible @room text", () => {
    const result = resolveMentions({
      content: {
        msgtype: "m.text",
        body: "@room hello everyone",
        "m.mentions": { room: true },
      },
      userId,
      text: "@room hello everyone",
      mentionRegexes,
    });
    expect(result.wasMentioned).toBe(true);
    expect(result.hasExplicitMention).toBe(true);
  });

  it("returns wasMentioned=false when userId is not in user_ids", () => {
    const result = resolveMentions({
      content: {
        msgtype: "m.text",
        body: "hello",
        "m.mentions": { user_ids: ["@other:matrix.org"] },
      },
      userId,
      text: "hello",
      mentionRegexes,
    });
    expect(result.wasMentioned).toBe(false);
  });

  it("detects mention by regex pattern when no m.mentions field", () => {
    const result = resolveMentions({
      content: { msgtype: "m.text", body: "hey @bot can you help" },
      userId,
      text: "hey @bot can you help",
      mentionRegexes,
    });
    expect(result.wasMentioned).toBe(true);
  });

  it("handles missing content fields gracefully", () => {
    const result = resolveMentions({
      content: { msgtype: "m.text", body: "no mention here" },
      userId,
      text: "no mention here",
      mentionRegexes: [],
    });
    expect(result.wasMentioned).toBe(false);
    expect(typeof result.hasExplicitMention).toBe("boolean");
  });
});
