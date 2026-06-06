import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { AgentRouteBinding } from "../config/types.agents.js";
import { resolveFirstBoundAccountId } from "./bound-account-read.js";

function cfgWithBindings(bindings: AgentRouteBinding[]): CoreBlowConfig {
  return { bindings } as unknown as CoreBlowConfig;
}

describe("resolveFirstBoundAccountId", () => {
  it("returns exact peer match when caller supplies a matching peerId", () => {
    const cfg = cfgWithBindings([
      {
        type: "route",
        agentId: "bot-alpha",
        match: { channel: "matrix", accountId: "bot-alpha-default" },
      },
      {
        type: "route",
        agentId: "bot-alpha",
        match: {
          channel: "matrix",
          peer: { kind: "channel", id: "!roomA:example.org" },
          accountId: "bot-alpha-room-a",
        },
      },
    ]);
    expect(
      resolveFirstBoundAccountId({
        cfg,
        channelId: "matrix",
        agentId: "bot-alpha",
        peerId: "!roomA:example.org",
      }),
    ).toBe("bot-alpha-room-a");
  });

  it("prefers wildcard peer binding over channel-only when caller peerKind matches", () => {
    const cfg = cfgWithBindings([
      {
        type: "route",
        agentId: "bot-alpha",
        match: { channel: "matrix", accountId: "bot-alpha-default" },
      },
      {
        type: "route",
        agentId: "bot-alpha",
        match: {
          channel: "matrix",
          peer: { kind: "channel", id: "*" },
          accountId: "bot-alpha-wildcard",
        },
      },
    ]);
    expect(
      resolveFirstBoundAccountId({
        cfg,
        channelId: "matrix",
        agentId: "bot-alpha",
        peerId: "!anyRoom:example.org",
        peerKind: "channel",
      }),
    ).toBe("bot-alpha-wildcard");
  });

  it("preserves first-match binding order for peerless callers", () => {
    const cfg = cfgWithBindings([
      {
        type: "route",
        agentId: "bot-alpha",
        match: {
          channel: "matrix",
          peer: { kind: "channel", id: "*" },
          accountId: "bot-alpha-wildcard",
        },
      },
      {
        type: "route",
        agentId: "bot-alpha",
        match: { channel: "matrix", accountId: "bot-alpha-default" },
      },
    ]);
    expect(resolveFirstBoundAccountId({ cfg, channelId: "matrix", agentId: "bot-alpha" })).toBe(
      "bot-alpha-wildcard",
    );
  });

  it("filters bindings by peer kind and treats group/channel as compatible", () => {
    const cfg = cfgWithBindings([
      {
        type: "route",
        agentId: "bot-alpha",
        match: {
          channel: "line",
          peer: { kind: "group", id: "*" },
          accountId: "bot-alpha-group",
        },
      },
    ]);
    expect(
      resolveFirstBoundAccountId({
        cfg,
        channelId: "line",
        agentId: "bot-alpha",
        peerId: "!roomA:example.org",
        peerKind: "channel",
      }),
    ).toBe("bot-alpha-group");
  });
});
