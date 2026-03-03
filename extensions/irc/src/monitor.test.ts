import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#coreblow",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#coreblow",
      rawTarget: "#coreblow",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "coreblow-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "coreblow-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "coreblow-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "coreblow-bot",
      rawTarget: "coreblow-bot",
    });
  });
});
