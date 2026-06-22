import { describe, expect, it } from "vitest";
import { TelnyxStreamFrameAdapter, TwilioStreamFrameAdapter } from "./stream-frame-adapter.js";

describe("TwilioStreamFrameAdapter", () => {
  it("parses Twilio start, media, mark, stop, and ignores junk", () => {
    const adapter = new TwilioStreamFrameAdapter();

    expect(
      adapter.parseInbound(
        JSON.stringify({
          event: "start",
          start: { streamSid: "MZ-stream", callSid: "CA-call" },
        }),
      ),
    ).toEqual({ kind: "start", streamId: "MZ-stream", providerCallId: "CA-call" });

    expect(
      adapter.parseInbound(
        JSON.stringify({
          event: "media",
          media: { payload: "AAA=", timestamp: "20", track: "inbound" },
        }),
      ),
    ).toEqual({
      kind: "media",
      payloadBase64: "AAA=",
      timestampMs: 20,
      track: "inbound",
    });
  });
});

describe("TelnyxStreamFrameAdapter", () => {
  it("surfaces Telnyx WS error frames so failures don't get swallowed", () => {
    const adapter = new TelnyxStreamFrameAdapter();

    expect(
      adapter.parseInbound(
        JSON.stringify({
          event: "error",
          stream_id: "telnyx-stream-7",
          payload: {
            code: 100002,
            title: "WebSocket error",
            detail: "Unable to decode payload",
          },
        }),
      ),
    ).toEqual({
      kind: "error",
      code: "100002",
      title: "WebSocket error",
      detail: "Unable to decode payload",
    });
  });
});
