// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { createTypingCallbacks } from "./typing.js";

describe("createTypingCallbacks", () => {
  it("invokes start on reply start", async () => {
    const startFn = vi.fn().mockResolvedValue(undefined);
    const stopFn = vi.fn().mockResolvedValue(undefined);

    const callbacks = createTypingCallbacks({
      start: startFn,
      stop: stopFn,
    });

    await callbacks.onReplyStart();
    expect(startFn).toHaveBeenCalledTimes(1);
  });

  it("handles start errors gracefully", async () => {
    const startFn = vi.fn().mockRejectedValue(new Error("start failed"));
    const stopFn = vi.fn().mockResolvedValue(undefined);

    const callbacks = createTypingCallbacks({
      start: startFn,
      stop: stopFn,
    });

    await expect(callbacks.onReplyStart()).resolves.toBeUndefined();
  });
});
