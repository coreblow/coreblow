import { describe, expect, it } from "vitest";
import { createAsyncLock } from "./async-lock-runtime.js";

describe("createAsyncLock SDK runtime", () => {
  it("serializes process-local async work", async () => {
    const withLock = createAsyncLock();
    const events: string[] = [];
    await Promise.all([
      withLock(async () => {
        events.push("first:start");
        await Promise.resolve();
        events.push("first:end");
      }),
      withLock(async () => {
        events.push("second");
      }),
    ]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });
});
