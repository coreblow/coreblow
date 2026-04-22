import { describe, expect, it } from "vitest";
import { buildSlackThreadingToolContext } from "./threading-tool-context.js";

function makeCfg(slackConfig: Record<string, unknown>): any {
  return { channels: { slack: slackConfig } };
}

describe("buildSlackThreadingToolContext", () => {
  it("uses top-level replyToMode by default", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({ replyToMode: "first" }),
      accountId: null,
      context: { ChatType: "channel" } as any,
    });
    expect(result.replyToMode).toBe("first");
  });

  it("uses chat-type override for direct messages", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({
        replyToMode: "off",
        replyToModeByChatType: { direct: "all" },
      }),
      accountId: null,
      context: { ChatType: "direct" } as any,
    });
    expect(result.replyToMode).toBe("all");
  });

  it("uses top-level replyToMode for channels when no channel override", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({
        replyToMode: "off",
        replyToModeByChatType: { direct: "all" },
      }),
      accountId: null,
      context: { ChatType: "channel" } as any,
    });
    expect(result.replyToMode).toBe("off");
  });

  it("forces replyToMode to 'all' when MessageThreadId is set", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({ replyToMode: "off" }),
      accountId: null,
      context: { ChatType: "channel", MessageThreadId: "1234.567" } as any,
    });
    expect(result.replyToMode).toBe("all");
  });

  it("exposes currentThreadTs from MessageThreadId", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({}),
      accountId: null,
      context: { ChatType: "channel", MessageThreadId: "1700000001.000" } as any,
    });
    expect(result.currentThreadTs).toBe("1700000001.000");
  });

  it("falls back to ReplyToId for currentThreadTs when MessageThreadId is absent", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({}),
      accountId: null,
      context: { ChatType: "channel", ReplyToId: "1700000002.000" } as any,
    });
    expect(result.currentThreadTs).toBe("1700000002.000");
  });

  it("extracts bare channel id from 'channel:C...' To field", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({}),
      accountId: null,
      context: { ChatType: "channel", To: "channel:C12345" } as any,
    });
    expect(result.currentChannelId).toBe("C12345");
  });

  it("falls back to NativeChannelId for DM contexts", () => {
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({}),
      accountId: null,
      context: { ChatType: "direct", To: "user:U999", NativeChannelId: "D12345" } as any,
    });
    expect(result.currentChannelId).toBe("D12345");
  });

  it("threads hasRepliedRef through to result", () => {
    const hasRepliedRef = { value: false };
    const result = buildSlackThreadingToolContext({
      cfg: makeCfg({}),
      accountId: null,
      context: { ChatType: "channel" } as any,
      hasRepliedRef,
    });
    expect(result.hasRepliedRef).toBe(hasRepliedRef);
  });
});
