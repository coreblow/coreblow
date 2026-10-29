import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryAsync } from "./retry.js";

const randomMocks = vi.hoisted(() => ({
  generateSecureFraction: vi.fn(),
}));

vi.mock("./secure-random.js", () => ({
  generateSecureFraction: randomMocks.generateSecureFraction,
}));

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  randomMocks.generateSecureFraction.mockReset();
});

describe("retryAsync respects server-supplied Retry-After as a lower bound", () => {
  it("honors Retry-After at the maxDelayMs boundary without undercut", async () => {
    randomMocks.generateSecureFraction.mockReturnValue(0);

    vi.useFakeTimers();
    const delays: number[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("429 retry-after at cap"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 1,
      maxDelayMs: 1_000,
      jitter: 0.5,
      retryAfterMs: () => 1_000,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBe(1_000);
  });

  it("preserves symmetric jitter when retryAfterMs exceeds maxDelayMs (avoids thundering herd)", async () => {
    randomMocks.generateSecureFraction.mockReturnValue(0);

    vi.useFakeTimers();
    const delays: number[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("429 retry-after too large"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 1,
      maxDelayMs: 1_000,
      jitter: 0.5,
      retryAfterMs: () => 10_000,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeLessThan(1_000);
  });

  it("does not round a non-integer retryAfterMs below its lower bound", async () => {
    randomMocks.generateSecureFraction.mockReturnValue(0);

    vi.useFakeTimers();
    const delays: number[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("429 non-integer retry-after"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 10,
      jitter: 0.5,
      retryAfterMs: () => 1.4,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(2);
  });

  it("never schedules a delay below retryAfterMs even at the low end of jitter", async () => {
    randomMocks.generateSecureFraction.mockReturnValue(0);

    vi.useFakeTimers();
    const delays: number[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("429 retry-after"))
      .mockResolvedValueOnce("ok");

    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 1,
      maxDelayMs: 60_000,
      jitter: 0.5,
      retryAfterMs: () => 1_000,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");

    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(1_000);
  });
});
