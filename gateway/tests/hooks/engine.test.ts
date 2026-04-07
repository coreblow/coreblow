import { describe, it, expect, beforeEach } from "vitest";
import { HooksEngine, type HookEntry } from "../../src/hooks/engine.js";

function makeHook(overrides: Partial<HookEntry> = {}): HookEntry {
  return {
    id: overrides.id ?? "test-hook",
    name: overrides.name ?? "test",
    source: overrides.source ?? "bundled",
    metadata: overrides.metadata ?? { events: ["test:event"] },
    handler: overrides.handler ?? (async () => {}),
    enabled: overrides.enabled ?? true,
  };
}

describe("HooksEngine", () => {
  let engine: HooksEngine;

  beforeEach(() => {
    engine = new HooksEngine();
  });

  it("registers and lists hooks", () => {
    engine.register(makeHook({ id: "h1" }));
    engine.register(makeHook({ id: "h2" }));
    expect(engine.list()).toHaveLength(2);
  });

  it("prevents duplicate IDs by replacing", () => {
    engine.register(makeHook({ id: "h1", name: "first" }));
    engine.register(makeHook({ id: "h1", name: "second" }));
    expect(engine.list()).toHaveLength(1);
    expect(engine.list()[0].name).toBe("second");
  });

  it("unregisters hooks", () => {
    engine.register(makeHook({ id: "h1" }));
    expect(engine.unregister("h1")).toBe(true);
    expect(engine.list()).toHaveLength(0);
  });

  it("unregister returns false for missing hook", () => {
    expect(engine.unregister("nonexistent")).toBe(false);
  });

  it("getHookById returns correct hook", () => {
    engine.register(makeHook({ id: "h1", name: "alpha" }));
    const found = engine.getHookById("h1");
    expect(found?.name).toBe("alpha");
    expect(engine.getHookById("missing")).toBeUndefined();
  });

  it("emits events to matching hooks", async () => {
    let called = false;
    engine.register(makeHook({
      id: "h1",
      metadata: { events: ["test:event"] },
      handler: async () => { called = true; },
    }));
    await engine.emit("test:event", {});
    expect(called).toBe(true);
  });

  it("does not call disabled hooks", async () => {
    let called = false;
    engine.register(makeHook({
      id: "h1",
      enabled: false,
      handler: async () => { called = true; },
    }));
    await engine.emit("test:event", {});
    expect(called).toBe(false);
  });

  it("supports wildcard event matching", async () => {
    let called = false;
    engine.register(makeHook({
      id: "h1",
      metadata: { events: ["test:*"] },
      handler: async () => { called = true; },
    }));
    await engine.emit("test:anything", {});
    expect(called).toBe(true);
  });

  it("supports global wildcard", async () => {
    let called = false;
    engine.register(makeHook({
      id: "h1",
      metadata: { events: ["*"] },
      handler: async () => { called = true; },
    }));
    await engine.emit("completely:different:event", {});
    expect(called).toBe(true);
  });

  it("respects priority ordering", async () => {
    const order: string[] = [];
    engine.register(makeHook({
      id: "low",
      metadata: { events: ["test:event"], priority: 200 },
      handler: async () => { order.push("low"); },
    }));
    engine.register(makeHook({
      id: "high",
      metadata: { events: ["test:event"], priority: 10 },
      handler: async () => { order.push("high"); },
    }));
    await engine.emit("test:event", {});
    expect(order).toEqual(["high", "low"]);
  });

  it("captures errors in results", async () => {
    engine.register(makeHook({
      id: "fail",
      handler: async () => { throw new Error("boom"); },
    }));
    const results = await engine.emit("test:event", {});
    expect(results[0].error).toBe("boom");
  });

  it("setEnabled toggles hook", () => {
    engine.register(makeHook({ id: "h1" }));
    expect(engine.setEnabled("h1", false)).toBe(true);
    expect(engine.getHookById("h1")?.enabled).toBe(false);
    expect(engine.setEnabled("missing", false)).toBe(false);
  });

  it("snapshot returns serializable state", () => {
    engine.register(makeHook({ id: "h1", metadata: { events: ["a", "b"], priority: 42 } }));
    const snap = engine.snapshot();
    expect(snap.hooks).toHaveLength(1);
    expect(snap.hooks[0].id).toBe("h1");
    expect(snap.hooks[0].events).toEqual(["a", "b"]);
    expect(snap.hooks[0].priority).toBe(42);
    expect(snap.version).toBeGreaterThan(0);
  });

  it("getHistory returns capped results", async () => {
    engine.register(makeHook({ id: "h1" }));
    await engine.emit("test:event", {});
    await engine.emit("test:event", {});
    const history = engine.getHistory();
    expect(history).toHaveLength(2);
  });

  it("clear resets engine state", () => {
    engine.register(makeHook({ id: "h1" }));
    engine.clear();
    expect(engine.list()).toHaveLength(0);
    expect(engine.snapshot().version).toBe(0);
  });
});
