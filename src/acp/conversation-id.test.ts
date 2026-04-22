import { describe, expect, it } from "vitest";
import {
  buildTelegramTopicConversationId,
  normalizeConversationText,
  parseTelegramChatIdFromTarget,
  parseTelegramTopicConversation,
} from "./conversation-id.js";

describe("normalizeConversationText", () => {
  it("trims string values", () => {
    expect(normalizeConversationText("  hello  ")).toBe("hello");
  });

  it("coerces numbers to string", () => {
    expect(normalizeConversationText(42)).toBe("42");
    expect(normalizeConversationText(-100)).toBe("-100");
  });

  it("coerces bigint to string", () => {
    expect(normalizeConversationText(BigInt(123))).toBe("123");
  });

  it("coerces boolean to string", () => {
    expect(normalizeConversationText(true)).toBe("true");
    expect(normalizeConversationText(false)).toBe("false");
  });

  it("returns empty string for null/undefined/object", () => {
    expect(normalizeConversationText(null)).toBe("");
    expect(normalizeConversationText(undefined)).toBe("");
    expect(normalizeConversationText({})).toBe("");
  });
});

describe("parseTelegramChatIdFromTarget", () => {
  it("extracts numeric chat id from telegram: prefix", () => {
    expect(parseTelegramChatIdFromTarget("telegram:-1001234567890")).toBe("-1001234567890");
    expect(parseTelegramChatIdFromTarget("telegram:123456")).toBe("123456");
  });

  it("returns undefined for plain numeric string without prefix", () => {
    expect(parseTelegramChatIdFromTarget("-1001234567890")).toBeUndefined();
  });

  it("returns undefined for non-numeric after telegram:", () => {
    expect(parseTelegramChatIdFromTarget("telegram:@username")).toBeUndefined();
  });

  it("returns undefined for empty value", () => {
    expect(parseTelegramChatIdFromTarget("")).toBeUndefined();
    expect(parseTelegramChatIdFromTarget(null)).toBeUndefined();
    expect(parseTelegramChatIdFromTarget(undefined)).toBeUndefined();
  });
});

describe("buildTelegramTopicConversationId", () => {
  it("builds chatId:topic:topicId format", () => {
    expect(buildTelegramTopicConversationId({ chatId: "-1001234567890", topicId: "42" })).toBe(
      "-1001234567890:topic:42",
    );
  });

  it("returns null for non-numeric chatId", () => {
    expect(buildTelegramTopicConversationId({ chatId: "@channel", topicId: "42" })).toBeNull();
  });

  it("returns null for non-numeric topicId", () => {
    expect(buildTelegramTopicConversationId({ chatId: "-100123", topicId: "abc" })).toBeNull();
  });

  it("trims whitespace from inputs", () => {
    expect(buildTelegramTopicConversationId({ chatId: " -100123 ", topicId: " 5 " })).toBe(
      "-100123:topic:5",
    );
  });
});

describe("parseTelegramTopicConversation", () => {
  it("parses direct chatId:topic:topicId format", () => {
    const result = parseTelegramTopicConversation({
      conversationId: "-1001234567890:topic:42",
    });
    expect(result).toEqual({
      chatId: "-1001234567890",
      topicId: "42",
      canonicalConversationId: "-1001234567890:topic:42",
    });
  });

  it("parses topicId from conversationId + parentConversationId", () => {
    const result = parseTelegramTopicConversation({
      conversationId: "42",
      parentConversationId: "-1001234567890",
    });
    expect(result).toEqual({
      chatId: "-1001234567890",
      topicId: "42",
      canonicalConversationId: "-1001234567890:topic:42",
    });
  });

  it("returns null when no parent and conversationId is just digits", () => {
    expect(parseTelegramTopicConversation({ conversationId: "42" })).toBeNull();
  });

  it("returns null for non-matching format", () => {
    expect(parseTelegramTopicConversation({ conversationId: "@channel" })).toBeNull();
    expect(parseTelegramTopicConversation({ conversationId: "" })).toBeNull();
  });

  it("returns null when parent is non-numeric", () => {
    const result = parseTelegramTopicConversation({
      conversationId: "42",
      parentConversationId: "@channel",
    });
    expect(result).toBeNull();
  });
});
