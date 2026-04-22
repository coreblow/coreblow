import { describe, expect, it } from "vitest";
import { locked } from "./locked.js";
import type { CronServiceState } from "./state.js";

function makeState(storePath = "/tmp/test-cron.json"): CronServiceState {
  return {
    store: null,
    running: false,
    timer: null,
    op: Promise.resolve(),
    warnedDisabled: false,
    storeLoadedAtMs: null,
    storeFileMtimeMs: null,
    deps: { storePath } as never,
  } as unknown as CronServiceState;
}

describe("locked()", () => {
  it("executes fn and returns its result", async () => {
    const state = makeState();
    const result = await locked(state, async () => 42);
    expect(result).toBe(42);
  });

  it("resolves a string return value", async () => {
    const state = makeState();
    const result = await locked(state, async () => "hello");
    expect(result).toBe("hello");
  });

  it("resolves an object return value", async () => {
    const state = makeState();
    const result = await locked(state, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it("serializes two sequential operations", async () => {
    const state = makeState();
    const order: number[] = [];
    await locked(state, async () => { order.push(1); });
    await locked(state, async () => { order.push(2); });
    expect(order).toEqual([1, 2]);
  });

  it("propagates thrown errors", async () => {
    const state = makeState();
    await expect(
      locked(state, async () => { throw new Error("cron-lock-err"); }),
    ).rejects.toThrow("cron-lock-err");
  });

  it("continues operating after a failed lock operation", async () => {
    const state = makeState();
    try {
      await locked(state, async () => { throw new Error("fail"); });
    } catch {
      // expected
    }
    const result = await locked(state, async () => "recovered");
    expect(result).toBe("recovered");
  });
});
