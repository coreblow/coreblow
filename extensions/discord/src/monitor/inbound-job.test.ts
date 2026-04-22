import { describe, expect, it } from "vitest";
import { resolveDiscordInboundJobQueueKey } from "./inbound-job.js";

function makeCtx(params: {
  routeSessionKey?: string;
  baseSessionKey?: string;
  messageChannelId?: string;
}): any {
  return {
    route: { sessionKey: params.routeSessionKey ?? "" },
    baseSessionKey: params.baseSessionKey ?? "",
    messageChannelId: params.messageChannelId ?? "channel-default",
  };
}

describe("resolveDiscordInboundJobQueueKey", () => {
  it("prefers route sessionKey when non-empty", () => {
    const ctx = makeCtx({
      routeSessionKey: "agent:main:discord:direct:routed",
      baseSessionKey: "agent:main:discord:direct:base",
      messageChannelId: "channel-1",
    });
    expect(resolveDiscordInboundJobQueueKey(ctx)).toBe(
      "agent:main:discord:direct:routed",
    );
  });

  it("falls back to baseSessionKey when route sessionKey is empty", () => {
    const ctx = makeCtx({
      routeSessionKey: "",
      baseSessionKey: "agent:main:discord:direct:base-only",
      messageChannelId: "channel-2",
    });
    expect(resolveDiscordInboundJobQueueKey(ctx)).toBe(
      "agent:main:discord:direct:base-only",
    );
  });

  it("falls back to messageChannelId when both session keys are blank", () => {
    const ctx = makeCtx({
      routeSessionKey: "   ",
      baseSessionKey: "   ",
      messageChannelId: "channel-fallback",
    });
    expect(resolveDiscordInboundJobQueueKey(ctx)).toBe("channel-fallback");
  });

  it("strips whitespace from routeSessionKey before checking", () => {
    const ctx = makeCtx({
      routeSessionKey: "  ",
      baseSessionKey: "base-key",
      messageChannelId: "channel-x",
    });
    expect(resolveDiscordInboundJobQueueKey(ctx)).toBe("base-key");
  });

  it("strips whitespace from baseSessionKey before checking", () => {
    const ctx = makeCtx({
      routeSessionKey: "",
      baseSessionKey: "  ",
      messageChannelId: "chan-final",
    });
    expect(resolveDiscordInboundJobQueueKey(ctx)).toBe("chan-final");
  });
});
