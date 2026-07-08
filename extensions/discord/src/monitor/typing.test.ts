import { describe, expect, it, vi } from "vitest";
import { sendTyping } from "./typing.js";

describe("sendTyping", () => {
  it("calls triggerTyping on the resolved channel", async () => {
    const triggerTyping = vi.fn(async () => {});
    const client = {
      fetchChannel: vi.fn(async () => ({ triggerTyping })),
    };

    await sendTyping({
      client: client as never,
      channelId: "12345",
    });

    expect(client.fetchChannel).toHaveBeenCalledWith("12345");
    expect(triggerTyping).toHaveBeenCalledTimes(1);
  });

  it("returns silently when channel is not found", async () => {
    const client = {
      fetchChannel: vi.fn(async () => undefined),
    };

    await expect(
      sendTyping({ client: client as never, channelId: "999" }),
    ).resolves.toBeUndefined();
  });

  it("returns silently when channel has no triggerTyping", async () => {
    const client = {
      fetchChannel: vi.fn(async () => ({})),
    };

    await expect(
      sendTyping({ client: client as never, channelId: "999" }),
    ).resolves.toBeUndefined();
  });
});
