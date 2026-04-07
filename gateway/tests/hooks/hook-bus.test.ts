import { describe, it, expect, beforeEach } from "vitest";
import { HookBus } from "../../src/hooks/hook-bus.js";

describe("HookBus", () => {
  let bus: HookBus;

  beforeEach(() => {
    bus = new HookBus();
  });

  it("registers and fires hooks", async () => {
    let called = false;
    bus.on("test", () => { called = true; });
    await bus.fire("test", {});
    expect(called).toBe(true);
  });

  it("fires multiple listeners in order", async () => {
    const results: number[] = [];
    bus.on("test", () => results.push(1));
    bus.on("test", () => results.push(2));
    await bus.fire("test", {});
    expect(results).toEqual([1, 2]);
  });

  it("does not fail on unknown event", async () => {
    await bus.fire("unknown", {});
  });

  it("supports wildcard type matching", async () => {
    let called = false;
    bus.on("message:*", () => { called = true; });
    await bus.fire("message:received", {});
    expect(called).toBe(true);
  });

  it("supports global wildcard", async () => {
    let called = false;
    bus.on("*", () => { called = true; });
    await bus.fire("anything:here", {});
    expect(called).toBe(true);
  });

  it("off removes a specific listener", async () => {
    let count = 0;
    const fn = () => { count++; };
    bus.on("test", fn);
    await bus.fire("test", {});
    expect(count).toBe(1);

    expect(bus.off("test", fn)).toBe(true);
    await bus.fire("test", {});
    expect(count).toBe(1); // not called again
  });

  it("off returns false for unknown listener", () => {
    expect(bus.off("test", () => {})).toBe(false);
  });

  it("hasListeners detects registered listeners", () => {
    expect(bus.hasListeners("test")).toBe(false);
    bus.on("test", () => {});
    expect(bus.hasListeners("test")).toBe(true);
  });

  it("hasListeners detects via wildcard", () => {
    bus.on("message:*", () => {});
    expect(bus.hasListeners("message:received")).toBe(true);
  });

  it("keys returns registered event keys", () => {
    bus.on("a", () => {});
    bus.on("b", () => {});
    expect(bus.keys()).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("listenerCount returns count for exact key", () => {
    bus.on("test", () => {});
    bus.on("test", () => {});
    expect(bus.listenerCount("test")).toBe(2);
    expect(bus.listenerCount("other")).toBe(0);
  });

  it("clear removes all listeners", () => {
    bus.on("a", () => {});
    bus.on("b", () => {});
    bus.clear();
    expect(bus.keys()).toEqual([]);
  });

  it("swallows errors in listeners", async () => {
    bus.on("test", () => { throw new Error("boom"); });
    bus.on("test", () => {}); // should still run
    // Should not throw
    await bus.fire("test", {});
  });
});
