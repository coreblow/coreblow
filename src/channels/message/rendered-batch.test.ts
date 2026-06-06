import { describe, expect, it } from "vitest";
import { createRenderedMessageBatch } from "./rendered-batch.js";

describe("createRenderedMessageBatch", () => {
  it("summarizes text, media, voice, presentation, interactive, and channel data", () => {
    expect(
      createRenderedMessageBatch([
        {
          text: " caption ",
          mediaUrls: ["file:///tmp/a.png", "file:///tmp/b.png"],
          audioAsVoice: true,
          presentation: { blocks: [{ type: "text", text: "card" }] },
          interactive: { blocks: [{ type: "buttons", buttons: [{ label: "OK", value: "ok" }] }] },
          channelData: { native: true },
        },
      ]),
    ).toEqual({
      payloads: [
        {
          text: " caption ",
          mediaUrls: ["file:///tmp/a.png", "file:///tmp/b.png"],
          audioAsVoice: true,
          presentation: { blocks: [{ type: "text", text: "card" }] },
          interactive: { blocks: [{ type: "buttons", buttons: [{ label: "OK", value: "ok" }] }] },
          channelData: { native: true },
        },
      ],
      plan: {
        payloadCount: 1,
        textCount: 1,
        mediaCount: 2,
        voiceCount: 1,
        presentationCount: 1,
        interactiveCount: 1,
        channelDataCount: 1,
        items: [
          {
            index: 0,
            kinds: ["text", "voice", "presentation", "interactive", "channelData"],
            text: "caption",
            mediaUrls: ["file:///tmp/a.png", "file:///tmp/b.png"],
            audioAsVoice: true,
            presentationBlockCount: 1,
            hasInteractive: true,
            hasChannelData: true,
          },
        ],
      },
    });
  });
});
