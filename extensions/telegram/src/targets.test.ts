import { describe, expect, it } from "vitest";
import {
  isNumericTelegramChatId,
  normalizeTelegramChatId,
  normalizeTelegramLookupTarget,
  parseTelegramTarget,
  resolveTelegramTargetChatType,
  stripTelegramInternalPrefixes,
} from "./targets.js";

describe("stripTelegramInternalPrefixes", () => {
  it("strips telegram: prefix", () => {
    expect(stripTelegramInternalPrefixes("telegram:123")).toBe("123");
  });

  it("strips tg: prefix", () => {
    expect(stripTelegramInternalPrefixes("tg:123")).toBe("123");
  });

  it("strips telegram:group: prefix", () => {
    expect(stripTelegramInternalPrefixes("telegram:group:-100123")).toBe("-100123");
  });

  it("does not strip group: prefix without telegram: prefix", () => {
    expect(stripTelegramInternalPrefixes("group:-100123")).toBe("group:-100123");
  });

  it("is idempotent for plain values", () => {
    expect(stripTelegramInternalPrefixes("@mychannel")).toBe("@mychannel");
    expect(stripTelegramInternalPrefixes("-1001234567890")).toBe("-1001234567890");
  });

  it("trims whitespace", () => {
    expect(stripTelegramInternalPrefixes("  123  ")).toBe("123");
  });
});

describe("normalizeTelegramChatId", () => {
  it("returns numeric chat id for valid numbers", () => {
    expect(normalizeTelegramChatId("-1001234567890")).toBe("-1001234567890");
    expect(normalizeTelegramChatId("123456")).toBe("123456");
  });

  it("strips telegram: prefix before normalizing", () => {
    expect(normalizeTelegramChatId("telegram:123")).toBe("123");
  });

  it("returns undefined for @username", () => {
    expect(normalizeTelegramChatId("@mychannel")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeTelegramChatId("")).toBeUndefined();
  });
});

describe("isNumericTelegramChatId", () => {
  it("returns true for numeric chat ids", () => {
    expect(isNumericTelegramChatId("-1001234567890")).toBe(true);
    expect(isNumericTelegramChatId("123456")).toBe(true);
    expect(isNumericTelegramChatId("-500")).toBe(true);
  });

  it("returns false for @username", () => {
    expect(isNumericTelegramChatId("@mychannel")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isNumericTelegramChatId("")).toBe(false);
  });
});

describe("parseTelegramTarget", () => {
  it("parses plain numeric chatId (group)", () => {
    expect(parseTelegramTarget("-1001234567890")).toEqual({
      chatId: "-1001234567890",
      chatType: "group",
    });
  });

  it("parses personal chatId (direct)", () => {
    expect(parseTelegramTarget("123456")).toEqual({
      chatId: "123456",
      chatType: "direct",
    });
  });

  it("parses @username", () => {
    expect(parseTelegramTarget("@mychannel")).toEqual({
      chatId: "@mychannel",
      chatType: "unknown",
    });
  });

  it("parses chatId:topicId format", () => {
    expect(parseTelegramTarget("-1001234567890:123")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 123,
      chatType: "group",
    });
  });

  it("parses chatId:topic:topicId format", () => {
    expect(parseTelegramTarget("-1001234567890:topic:456")).toEqual({
      chatId: "-1001234567890",
      messageThreadId: 456,
      chatType: "group",
    });
  });
});

describe("resolveTelegramTargetChatType", () => {
  it("returns 'group' for negative numeric ids", () => {
    expect(resolveTelegramTargetChatType("-1001234567890")).toBe("group");
  });

  it("returns 'direct' for positive numeric ids", () => {
    expect(resolveTelegramTargetChatType("123456")).toBe("direct");
  });

  it("returns 'unknown' for @usernames", () => {
    expect(resolveTelegramTargetChatType("@mychannel")).toBe("unknown");
  });
});

describe("normalizeTelegramLookupTarget", () => {
  it("normalizes numeric ids", () => {
    expect(normalizeTelegramLookupTarget("123456")).toBe("123456");
  });

  it("normalizes @username preserving @ prefix", () => {
    const result = normalizeTelegramLookupTarget("@MyChannel");
    expect(result).toBeDefined();
    expect(result?.startsWith("@")).toBe(true);
  });

  it("returns undefined for empty string", () => {
    expect(normalizeTelegramLookupTarget("")).toBeUndefined();
  });
});
