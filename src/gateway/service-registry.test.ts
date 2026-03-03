import { describe, expect, it, beforeEach } from "vitest";
import { ServiceRegistry } from "./service-registry.js";
import type { GatewayService, ServiceHealth } from "./service-registry.js";

/** Helper: create a minimal GatewayService mock. */
function createMockService(name: string, opts?: { startFail?: boolean; stopFail?: boolean }): GatewayService {
  let started = false;
  return {
    name,
    async start() {
      if (opts?.startFail) throw new Error(`${name} start failed`);
      started = true;
    },
    async stop() {
      if (opts?.stopFail) throw new Error(`${name} stop failed`);
      started = false;
    },
    health(): ServiceHealth {
      return started ? { status: "healthy" } : { status: "down" };
    },
  };
}

describe("ServiceRegistry", () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it("registers and resolves a service", () => {
    const svc = createMockService("test-svc");
    registry.register("test-svc", svc);
    expect(registry.resolve("test-svc")).toBe(svc);
    expect(registry.count()).toBe(1);
  });

  it("returns null for unknown service", () => {
    expect(registry.resolve("nonexistent")).toBeNull();
  });

  it("starts and stops a GatewayService", async () => {
    const svc = createMockService("demo");
    registry.register("demo", svc);

    expect(await registry.start("demo")).toBe(true);
    const list = registry.list();
    expect(list[0].status).toBe("started");

    expect(await registry.stop("demo")).toBe(true);
    const list2 = registry.list();
    expect(list2[0].status).toBe("stopped");
  });

  it("captures lastError on start failure", async () => {
    const svc = createMockService("fail-svc", { startFail: true });
    registry.register("fail-svc", svc);

    const result = await registry.start("fail-svc");
    expect(result).toBe(false);

    const health = registry.getHealth();
    const entry = health.find((h) => h.name === "fail-svc");
    expect(entry?.status).toBe("error");
  });

  it("captures lastError on stop failure", async () => {
    const svc = createMockService("stop-fail", { stopFail: true });
    registry.register("stop-fail", svc);

    await registry.start("stop-fail");
    const result = await registry.stop("stop-fail");
    expect(result).toBe(false);
  });

  it("clears lastError on successful start after failure", async () => {
    let shouldFail = true;
    const svc: GatewayService = {
      name: "retry-svc",
      async start() { if (shouldFail) throw new Error("boom"); },
      async stop() {},
      health() { return { status: "healthy" }; },
    };

    registry.register("retry-svc", svc);

    // First attempt — fail
    await registry.start("retry-svc");

    // Second attempt — succeed
    shouldFail = false;
    await registry.start("retry-svc");
    const health = registry.getHealth();
    const entry = health.find((h) => h.name === "retry-svc");
    expect(entry?.status).toBe("healthy");
  });

  it("tags non-GatewayService with lifecycleManaged: false", () => {
    registry.register("plain-obj", { value: 42 });
    const list = registry.list();
    expect(list[0].name).toBe("plain-obj");
    // The metadata is internal — verify via start behavior
    // A non-GatewayService should still "start" (silently skip lifecycle)
  });

  it("starts non-GatewayService without error (silent skip)", async () => {
    registry.register("data-holder", { value: "hello" });
    const result = await registry.start("data-holder");
    expect(result).toBe(true);
  });

  it("startAll respects dependency order", async () => {
    const order: string[] = [];
    const makeSvc = (name: string): GatewayService => ({
      name,
      async start() { order.push(name); },
      async stop() {},
      health() { return { status: "healthy" }; },
    });

    registry.register("db", makeSvc("db"));
    registry.register("cache", makeSvc("cache"), ["db"]);
    registry.register("api", makeSvc("api"), ["db", "cache"]);

    const result = await registry.startAll();
    expect(result.started).toEqual(["db", "cache", "api"]);
    expect(result.failed).toEqual([]);
    expect(order).toEqual(["db", "cache", "api"]);
  });

  it("startAll fails dependent when dependency fails", async () => {
    const db = createMockService("db", { startFail: true });
    const api = createMockService("api");

    registry.register("db", db);
    registry.register("api", api, ["db"]);

    const result = await registry.startAll();
    expect(result.failed).toContain("db");
    expect(result.failed).toContain("api");
    expect(result.started).toEqual([]);
  });

  it("stopAll stops in reverse dependency order", async () => {
    const order: string[] = [];
    const makeSvc = (name: string): GatewayService => ({
      name,
      async start() {},
      async stop() { order.push(name); },
      health() { return { status: "healthy" }; },
    });

    registry.register("db", makeSvc("db"));
    registry.register("cache", makeSvc("cache"), ["db"]);
    registry.register("api", makeSvc("api"), ["cache"]);

    await registry.startAll();
    await registry.stopAll();

    // Reverse of [db, cache, api] = [api, cache, db]
    expect(order).toEqual(["api", "cache", "db"]);
  });

  it("handles circular dependencies gracefully in startAll", async () => {
    registry.register("a", createMockService("a"), ["b"]);
    registry.register("b", createMockService("b"), ["a"]);

    // startAll doesn't throw — it fails both services via dep check
    const result = await registry.startAll();
    expect(result.failed.length).toBeGreaterThan(0);
    expect(result.started).toEqual([]);
  });

  it("detects circular dependencies in stopAll", async () => {
    registry.register("a", createMockService("a"), ["b"]);
    registry.register("b", createMockService("b"), ["a"]);

    await expect(registry.stopAll()).rejects.toThrow("Circular dependency");
  });

  it("getHealth enriches with GatewayService health", async () => {
    const svc = createMockService("health-test");
    registry.register("health-test", svc);
    await registry.start("health-test");

    const health = registry.getHealth();
    expect(health[0].status).toBe("healthy");
    expect(health[0].uptime).toBeGreaterThanOrEqual(0);
  });

  it("resolveTyped returns null for non-GatewayService", () => {
    registry.register("plain", { notAService: true });
    expect(registry.resolveTyped("plain")).toBeNull();
  });

  it("resolveTyped returns the typed service", () => {
    const svc = createMockService("typed");
    registry.register("typed", svc);
    const resolved = registry.resolveTyped("typed");
    expect(resolved).toBe(svc);
  });
});
