import type { ChatStreamer } from "@slack/web-api/dist/chat-stream.js";
import { describe, expect, it, vi } from "vitest";
import {
  appendSlackStream,
  extractSlackErrorCode,
  isBenignSlackFinalizeError,
  markSlackStreamFallbackDelivered,
  SlackStreamNotDeliveredError,
  startSlackStream,
  stopSlackStream,
  type SlackStreamSession,
} from "./streaming.js";

type AppendImpl = () => Promise<unknown>;
type StopImpl = (args?: unknown) => Promise<void>;

function makeSession(params: { appendImpl?: AppendImpl; stopImpl?: StopImpl }): SlackStreamSession {
  return {
    streamer: {
      append: vi.fn(params.appendImpl ?? (async () => null)),
      stop: vi.fn(params.stopImpl ?? (async () => {})),
    } as unknown as ChatStreamer,
    channel: "C123",
    threadTs: "1700000000.000100",
    stopped: false,
    delivered: false,
    pendingText: "",
  };
}

function slackApiError(code: string): Error {
  const err = new Error(`An API error occurred: ${code}`);
  (err as unknown as { data: { error: string } }).data = { error: code };
  return err;
}

describe("stopSlackStream finalize error handling", () => {
  it("swallows user_not_found after prior append flushed (delivered=true)", async () => {
    const session = makeSession({
      appendImpl: async () => ({ ts: "1700000000.100200" }), // non-null => flushed
      stopImpl: async () => {
        throw slackApiError("user_not_found");
      },
    });
    await appendSlackStream({ session, text: "some text that Slack saw" });
    expect(session.delivered).toBe(true);

    await expect(stopSlackStream({ session })).resolves.toBeUndefined();
    expect(session.stopped).toBe(true);
  });

  it("throws SlackStreamNotDeliveredError when user_not_found fires before any flush", async () => {
    const session = makeSession({
      appendImpl: async () => null, // null => buffered, never hit Slack
      stopImpl: async () => {
        throw slackApiError("user_not_found");
      },
    });
    await appendSlackStream({ session, text: "short reply under buffer size" });
    expect(session.delivered).toBe(false);

    const thrown = await stopSlackStream({ session }).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(SlackStreamNotDeliveredError);
    expect((thrown as SlackStreamNotDeliveredError).slackCode).toBe("user_not_found");
    expect((thrown as SlackStreamNotDeliveredError).pendingText).toBe(
      "short reply under buffer size",
    );
    expect(session.stopped).toBe(true);
  });

  it("throws SlackStreamNotDeliveredError carrying stop()'s final text too", async () => {
    const session = makeSession({
      appendImpl: async () => null,
      stopImpl: async () => {
        throw slackApiError("team_not_found");
      },
    });
    await appendSlackStream({ session, text: "hello " });

    const thrown = await stopSlackStream({ session, text: "world" }).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(SlackStreamNotDeliveredError);
    expect((thrown as SlackStreamNotDeliveredError).slackCode).toBe("team_not_found");
    expect((thrown as SlackStreamNotDeliveredError).pendingText).toBe("hello world");
  });

  it("clears pendingText after an append flush is acknowledged by Slack", async () => {
    const session = makeSession({
      appendImpl: async () => ({ ts: "1700000000.100203" }),
    });

    await appendSlackStream({ session, text: "flushed text" });

    expect(session.delivered).toBe(true);
    expect(session.pendingText).toBe("");
  });

  it("passes message metadata when finalizing the stream", async () => {
    const stopImpl = vi.fn(async () => {});
    const session = makeSession({ stopImpl });
    const metadata = {
      event_type: "assistant_thread_context",
      event_payload: { channel_id: "C123", team_id: "T123" },
    };

    await stopSlackStream({ session, metadata });

    expect(stopImpl).toHaveBeenCalledWith({ metadata });
  });

  it("throws SlackStreamNotDeliveredError with buffered text when append flush fails", async () => {
    const session = makeSession({
      appendImpl: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(slackApiError("user_not_found")),
    });

    await appendSlackStream({ session, text: "first buffered" });
    const thrown = await appendSlackStream({ session, text: "\nsecond flushes" }).catch(
      (err: unknown) => err,
    );

    expect(thrown).toBeInstanceOf(SlackStreamNotDeliveredError);
    expect((thrown as SlackStreamNotDeliveredError).pendingText).toBe(
      "first buffered\nsecond flushes",
    );
  });

  it("re-throws unexpected Slack API errors even when delivered", async () => {
    const session = makeSession({
      appendImpl: async () => ({ ts: "1700000000.100202" }),
      stopImpl: async () => {
        throw slackApiError("not_authed");
      },
    });
    await appendSlackStream({ session, text: "some text" });
    await expect(stopSlackStream({ session })).rejects.toThrow(/not_authed/);
    expect(session.stopped).toBe(true);
  });

  it("re-throws non-Slack-shaped errors unchanged", async () => {
    const session = makeSession({
      stopImpl: async () => {
        throw new Error("socket reset");
      },
    });
    await expect(stopSlackStream({ session })).rejects.toThrow(/socket reset/);
    expect(session.stopped).toBe(true);
  });

  it("returns a no-op on an already-stopped session", async () => {
    const stop = vi.fn(async () => {});
    const session: SlackStreamSession = {
      streamer: { append: vi.fn(async () => null), stop } as unknown as ChatStreamer,
      channel: "C123",
      threadTs: "1700000000.000100",
      stopped: true,
      delivered: false,
      pendingText: "",
    };
    await expect(stopSlackStream({ session })).resolves.toBeUndefined();
    expect(stop).not.toHaveBeenCalled();
  });

  it("marks delivered=true on successful stop() without prior flush", async () => {
    const session = makeSession({
      appendImpl: async () => null,
      stopImpl: async () => {},
    });
    await appendSlackStream({ session, text: "short" });
    expect(session.delivered).toBe(false);
    await stopSlackStream({ session });
    expect(session.delivered).toBe(true);
    expect(session.pendingText).toBe("");
  });

  it("converts a start-time flush rejection into a pending-text fallback error", async () => {
    const client = {
      chatStream: () => ({
        append: async () => {
          throw slackApiError("user_not_found");
        },
        stop: async () => {},
      }),
    };

    const thrown = await startSlackStream({
      client: client as never,
      channel: "C123",
      threadTs: "1700000000.000100",
      text: "initial chunk that flushes immediately",
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(SlackStreamNotDeliveredError);
    expect((thrown as SlackStreamNotDeliveredError).pendingText).toBe(
      "initial chunk that flushes immediately",
    );
  });

  it("marks fallback-delivered sessions stopped only when no native stream exists", () => {
    const neverDelivered = makeSession({});
    markSlackStreamFallbackDelivered(neverDelivered);
    expect(neverDelivered.delivered).toBe(true);
    expect(neverDelivered.pendingText).toBe("");
    expect(neverDelivered.stopped).toBe(true);

    const alreadyDelivered = makeSession({});
    alreadyDelivered.delivered = true;
    markSlackStreamFallbackDelivered(alreadyDelivered);
    expect(alreadyDelivered.delivered).toBe(true);
    expect(alreadyDelivered.pendingText).toBe("");
    expect(alreadyDelivered.stopped).toBe(false);
  });
});

describe("error classification", () => {
  it("isBenignSlackFinalizeError matches each allowlisted code", () => {
    for (const code of ["user_not_found", "team_not_found", "missing_recipient_user_id"]) {
      expect(isBenignSlackFinalizeError(slackApiError(code))).toBe(true);
    }
  });

  it("isBenignSlackFinalizeError rejects non-listed codes", () => {
    for (const code of ["not_authed", "ratelimited", "channel_not_found"]) {
      expect(isBenignSlackFinalizeError(slackApiError(code))).toBe(false);
    }
  });

  it("extractSlackErrorCode handles data.error, message fallback, and junk shapes", () => {
    expect(extractSlackErrorCode(slackApiError("user_not_found"))).toBe("user_not_found");
    expect(extractSlackErrorCode(new Error("An API error occurred: rate_limited"))).toBe(
      "rate_limited",
    );
    const wrongShape = new Error("plain message");
    (wrongShape as unknown as { data: unknown }).data = { error: 42 };
    expect(extractSlackErrorCode(wrongShape)).toBeUndefined();
    (wrongShape as unknown as { data: unknown }).data = null;
    expect(extractSlackErrorCode(wrongShape)).toBeUndefined();
    expect(extractSlackErrorCode("raw string")).toBeUndefined();
    expect(extractSlackErrorCode(null)).toBeUndefined();
    expect(extractSlackErrorCode(undefined)).toBeUndefined();
  });
});
