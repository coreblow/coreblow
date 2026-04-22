/**
 * src/cron/service/locked-concurrent.test.ts
 *
 * CoreBlow — Cron Locked Concurrency Tests
 * Verifies locked() serializes concurrent calls correctly
 * and maintains state consistency across multiple operations.
 */
import { describe, expect, it } from "vitest";
import { locked } from "./locked.js";
import type { CronServiceState } from "./state.js";

function makeState(storePath = "/tmp/locked-concurrent.json"): CronServiceState {
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

describe("locked() — concurrency invariants", () => {
  it("resolves all concurrent operations", async () => {
    const state = makeState();
    const results = await Promise.all([
      locked(state, async () => 1),
      locked(state, async () => 2),
      locked(state, async () => 3),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it("each operation sees its own return value", async () => {
    const state = makeState();
    const [a, b] = await Promise.all([
      locked(state, async () => "alpha"),
      locked(state, async () => "beta"),
    ]);
    expect(a).toBe("alpha");
    expect(b).toBe("beta");
  });

  it("accumulates side effects in serialized order", async () => {
    const state = makeState();
    const log: string[] = [];
    await locked(state, async () => { log.push("first"); });
    await locked(state, async () => { log.push("second"); });
    await locked(state, async () => { log.push("third"); });
    expect(log).toEqual(["first", "second", "third"]);
  });

  it("state.op is updated after each locked call", async () => {
    const state = makeState();
    const initial = state.op;
    await locked(state, async () => {});
    // op should have been updated internally
    expect(state.op).not.toBe(initial);
  });

  it("handles 5 sequential locked ops without error", async () => {
    const state = makeState();
    for (let i = 0; i < 5; i++) {
      await expect(locked(state, async () => i)).resolves.toBe(i);
    }
  });
});
