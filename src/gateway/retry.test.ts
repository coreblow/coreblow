import { describe, it, expect, vi } from "vitest";
import { calculateDelay, withRetry, CircuitBreaker } from "./retry.js";

describe("calculateDelay", () => {
  it("computes exponential backoff", () => {
    const cfg = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 10000, jitter: false, backoffMultiplier: 2 };
    expect(calculateDelay(1, cfg)).toBe(100);
    expect(calculateDelay(2, cfg)).toBe(200);
    expect(calculateDelay(3, cfg)).toBe(400);
  });

  it("caps delay at maxDelayMs", () => {
    const cfg = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 500, jitter: false, backoffMultiplier: 2 };
    expect(calculateDelay(1, cfg)).toBe(500);
    expect(calculateDelay(2, cfg)).toBe(500);
  });

  it("applies jitter (result is 0..capped)", () => {
    const cfg = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true, backoffMultiplier: 2 };
    const delays = Array.from({ length: 100 }, () => calculateDelay(1, cfg));
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1000);
    }
  });
});

describe("withRetry", () => {
  it("returns success on first attempt", async () => {
    const result = await withRetry(() => Promise.resolve(42), { maxAttempts: 3 });
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.attempts).toBe(1);
  });

  it("retries on failure and succeeds", async () => {
    let count = 0;
    const result = await withRetry(
      () => {
        count++;
        if (count < 3) throw new Error("fail");
        return Promise.resolve("ok");
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, jitter: false, backoffMultiplier: 1 },
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe("ok");
    expect(result.attempts).toBe(3);
  });

  it("fails after max attempts exhausted", async () => {
    const result = await withRetry(
      () => Promise.reject(new Error("always fail")),
      { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false, backoffMultiplier: 1 },
    );
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("always fail");
    expect(result.attempts).toBe(2);
  });

  it("stops retrying on non-retryable errors", async () => {
    const result = await withRetry(
      () => Promise.reject(new Error("AUTH_FAILED: invalid key")),
      {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitter: false,
        backoffMultiplier: 1,
        nonRetryableErrors: ["AUTH_FAILED"],
      },
    );
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });
});

describe("CircuitBreaker", () => {
  it("starts in closed state", () => {
    const cb = new CircuitBreaker("test");
    expect(cb.getState()).toBe("closed");
  });

  it("opens circuit after failure threshold", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 2, resetTimeMs: 100, successThreshold: 1 });

    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    expect(cb.getState()).toBe("open");
    await expect(cb.execute(() => Promise.resolve("ok"))).rejects.toThrow('Circuit breaker "test" is OPEN');
  });

  it("transitions to half-open after reset time", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeMs: 10, successThreshold: 1 });

    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    expect(cb.getState()).toBe("open");

    await new Promise((r) => setTimeout(r, 20));
    expect(cb.getState()).toBe("half-open");
  });

  it("closes circuit after success threshold in half-open", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeMs: 10, successThreshold: 2 });

    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    await new Promise((r) => setTimeout(r, 20));

    // Half-open: succeed twice
    await cb.execute(() => Promise.resolve("ok1"));
    await cb.execute(() => Promise.resolve("ok2"));

    expect(cb.getState()).toBe("closed");
  });

  it("re-opens circuit on failure during half-open", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeMs: 10, successThreshold: 2 });

    await cb.execute(() => Promise.reject(new Error("fail1"))).catch(() => {});
    await new Promise((r) => setTimeout(r, 20));

    // Half-open: fail again
    await cb.execute(() => Promise.reject(new Error("fail2"))).catch(() => {});
    expect(cb.getState()).toBe("open");
  });

  it("fires state change listeners", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeMs: 100000, successThreshold: 1 });
    const states: string[] = [];
    cb.onStateChange((s) => states.push(s));

    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    expect(states).toContain("open");
  });

  it("reports info correctly", () => {
    const cb = new CircuitBreaker("my-breaker");
    const info = cb.getInfo();
    expect(info.name).toBe("my-breaker");
    expect(info.state).toBe("closed");
    expect(info.failures).toBe(0);
    expect(info.successes).toBe(0);
  });

  it("force resets to closed", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeMs: 100000, successThreshold: 1 });
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    expect(cb.getState()).toBe("open");

    cb.reset();
    expect(cb.getState()).toBe("closed");
  });
});
