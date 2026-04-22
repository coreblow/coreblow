/**
 * src/infra/debounce-throttle.test.ts
 *
 * CoreBlow — Debounce & Throttle Tests
 * Verifies debounce, throttle, and DebounceThrottleService.
 */
import { describe, beforeEach, afterEach, expect, it, vi } from "vitest";
import { debounce, throttle } from "./debounce-throttle.js";

describe("debounce()", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delays function execution by waitMs", async () => {
    const fn = vi.fn().mockResolvedValue("done");
    const debounced = debounce(fn, 100);

    const promise = debounced();
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(promise).resolves.toBe("done");
  });

  it("cancels previous call on rapid invocations", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const debounced = debounce(fn, 100);

    debounced(); // first — will be cancelled
    debounced(); // second — will be cancelled
    const last = debounced(); // third — should execute

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(last).resolves.toBe("result");
  });

  it("exposes cancel() method", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    expect(typeof debounced.cancel).toBe("function");
  });
});

describe("throttle()", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is a function", () => {
    expect(typeof throttle).toBe("function");
  });

  it("returns a callable function", () => {
    const fn = vi.fn().mockReturnValue("x");
    const throttled = throttle(fn, 100);
    expect(typeof throttled).toBe("function");
  });
});
