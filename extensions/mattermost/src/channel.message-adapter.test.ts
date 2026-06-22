import {
  verifyChannelMessageAdapterCapabilityProofs,
  verifyChannelMessageLiveCapabilityAdapterProofs,
  verifyChannelMessageLiveFinalizerProofs,
} from "coreblow/plugin-sdk/channel-message";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelMessageAdapterShape } from "../../../src/channels/message/types.js";

const sendMessageMattermostMock = vi.hoisted(() => vi.fn());

vi.mock("./mattermost/send.js", () => ({
  sendMessageMattermost: sendMessageMattermostMock,
}));

type MattermostMessageAdapter = ChannelMessageAdapterShape;

let mattermostPluginModule: typeof import("./channel.js");

function requireMattermostMessageAdapter(): MattermostMessageAdapter {
  const { mattermostPlugin } = mattermostPluginModule;
  const adapter = (mattermostPlugin as typeof mattermostPlugin & {
    message?: MattermostMessageAdapter;
  }).message;
  if (!adapter) {
    throw new Error("Expected mattermost plugin to expose a channel message adapter");
  }
  return adapter;
}

describe("mattermost channel message adapter", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendMessageMattermostMock.mockReset();
    sendMessageMattermostMock.mockResolvedValue({
      messageId: "post-1",
      channelId: "channel-1",
    });
    mattermostPluginModule = await import("./channel.js");
  });

  it("declares durable-final capabilities covered by outbound proof tests", async () => {
    const adapter = requireMattermostMessageAdapter();

    await verifyChannelMessageAdapterCapabilityProofs({
      adapterName: "mattermostMessageAdapter",
      adapter,
      proofs: {
        text: () => undefined,
        media: () => undefined,
        payload: () => undefined,
        replyTo: () => undefined,
        thread: () => undefined,
      },
    });
  });

  it("sends text, media, and button payloads through Mattermost", async () => {
    const adapter = requireMattermostMessageAdapter();

    const textResult = await adapter.send?.text?.({
      cfg: {},
      to: "channel:team-1",
      text: "hello",
      accountId: "default",
    });
    expect(sendMessageMattermostMock).toHaveBeenNthCalledWith(1, "channel:team-1", "hello", {
      cfg: {},
      accountId: "default",
      replyToId: undefined,
    });
    expect(textResult?.receipt.parts[0]?.kind).toBe("text");

    const mediaResult = await adapter.send?.media?.({
      cfg: {},
      to: "channel:team-1",
      text: "caption",
      mediaUrl: "https://example.com/a.png",
      mediaLocalRoots: ["/tmp/media"],
      accountId: "default",
    });
    expect(sendMessageMattermostMock).toHaveBeenNthCalledWith(
      2,
      "channel:team-1",
      "caption",
      {
        cfg: {},
        accountId: "default",
        mediaUrl: "https://example.com/a.png",
        mediaLocalRoots: ["/tmp/media"],
        replyToId: undefined,
      },
    );
    expect(mediaResult?.receipt.parts[0]?.kind).toBe("media");

    const payloadResult = await adapter.send?.payload?.({
      cfg: {},
      to: "channel:team-1",
      text: "card",
      accountId: "default",
      payload: {
        text: "card",
        channelData: {
          mattermost: {
            presentationButtons: [[{ text: "Open", callback_data: "open" }]],
          },
        },
      },
    });
    expect(sendMessageMattermostMock).toHaveBeenNthCalledWith(3, "channel:team-1", "card", {
      cfg: {},
      accountId: "default",
      mediaUrl: undefined,
      mediaLocalRoots: undefined,
      replyToId: undefined,
      buttons: [[{ text: "Open", callback_data: "open" }]],
    });
    expect(payloadResult?.receipt.platformMessageIds).toEqual(["post-1"]);
  });

  it("backs declared live preview finalizer capabilities with adapter proofs", async () => {
    const adapter = requireMattermostMessageAdapter();

    await verifyChannelMessageLiveCapabilityAdapterProofs({
      adapterName: "mattermostMessageAdapter",
      adapter,
      proofs: {
        draftPreview: () => {
          expect(adapter.live?.finalizer?.capabilities?.discardPending).toBe(true);
        },
        previewFinalization: () => {
          expect(adapter.live?.finalizer?.capabilities?.finalEdit).toBe(true);
        },
        progressUpdates: () => {
          expect(adapter.live?.capabilities?.draftPreview).toBe(true);
        },
      },
    });

    await verifyChannelMessageLiveFinalizerProofs({
      adapterName: "mattermostMessageAdapter",
      adapter,
      proofs: {
        finalEdit: () => {
          expect(adapter.live?.capabilities?.previewFinalization).toBe(true);
        },
        normalFallback: () => {
          expect(adapter.send?.text).toBeTypeOf("function");
        },
        discardPending: () => {
          expect(adapter.live?.capabilities?.draftPreview).toBe(true);
        },
      },
    });
  });
});
