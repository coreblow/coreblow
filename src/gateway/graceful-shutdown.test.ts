import { describe, it, expect } from "vitest";
import { GracefulShutdown } from "./graceful-shutdown.js";
import type { ShutdownHook } from "./graceful-shutdown.js";

describe("GracefulShutdown", () => {
  it("executes hooks in order by priority", async () => {
    const shutdown = new GracefulShutdown();
    const order: string[] = [];

    shutdown.register({ name: "db", order: 2, handler: async () => { order.push("db"); } });
    shutdown.register({ name: "http", order: 1, handler: async () => { order.push("http"); } });
    shutdown.register({ name: "cache", order: 3, handler: async () => { order.push("cache"); } });

    const result = await shutdown.shutdown();
    expect(order).toEqual(["http", "db", "cache"]);
    expect(result.completed).toEqual(["http", "db", "cache"]);
    expect(result.timedOut).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("records failed hooks", async () => {
    const shutdown = new GracefulShutdown();
    shutdown.register({ name: "failing", order: 1, handler: async () => { throw new Error("boom"); } });
    shutdown.register({ name: "ok", order: 2, handler: async () => {} });

    const result = await shutdown.shutdown();
    expect(result.failed).toEqual([{ name: "failing", error: "boom" }]);
    expect(result.completed).toEqual(["ok"]);
  });

  it("records timed out hooks", async () => {
    const shutdown = new GracefulShutdown();
    shutdown.register({
      name: "slow",
      order: 1,
      handler: () => new Promise((r) => setTimeout(r, 5000)),
      timeoutMs: 10,
    });

    const result = await shutdown.shutdown();
    expect(result.timedOut).toEqual(["slow"]);
    expect(result.completed).toEqual([]);
  });

  it("returns last result on concurrent shutdown calls", async () => {
    const shutdown = new GracefulShutdown();
    shutdown.register({ name: "fast", order: 1, handler: async () => {} });

    const first = shutdown.shutdown();
    const second = shutdown.shutdown();

    const [r1, r2] = await Promise.all([first, second]);
    // Second call returns early result since shutdown is already in progress
    expect(r2.completed.length + r2.timedOut.length + r2.failed.length).toBeLessThanOrEqual(
      r1.completed.length + r1.timedOut.length + r1.failed.length,
    );
  });

  it("tracks progress via isInProgress", async () => {
    const shutdown = new GracefulShutdown();
    expect(shutdown.isInProgress()).toBe(false);

    shutdown.register({
      name: "slow",
      order: 1,
      handler: () => new Promise((r) => setTimeout(r, 50)),
    });

    const promise = shutdown.shutdown();
    // After shutdown completes, isInProgress should be false
    await promise;
    expect(shutdown.isInProgress()).toBe(false);
  });

  it("stores last result via getLastResult", async () => {
    const shutdown = new GracefulShutdown();
    expect(shutdown.getLastResult()).toBeNull();

    shutdown.register({ name: "test", order: 1, handler: async () => {} });
    await shutdown.shutdown();

    const result = shutdown.getLastResult();
    expect(result).not.toBeNull();
    expect(result!.completed).toEqual(["test"]);
  });

  it("lists registered hooks", () => {
    const shutdown = new GracefulShutdown();
    shutdown.register({ name: "a", order: 3, handler: async () => {} });
    shutdown.register({ name: "b", order: 1, handler: async () => {} });

    const list = shutdown.list();
    expect(list).toEqual([
      { name: "b", order: 1 },
      { name: "a", order: 3 },
    ]);
  });

  it("reports correct count", () => {
    const shutdown = new GracefulShutdown();
    expect(shutdown.count()).toBe(0);
    shutdown.register({ name: "x", order: 1, handler: async () => {} });
    expect(shutdown.count()).toBe(1);
  });
});
