import { describe, beforeEach, expect, it, vi } from "vitest";
import { EventTracker } from "./event-tracker.js";

let tracker: EventTracker;

beforeEach(() => {
  tracker = new EventTracker();
});

describe("EventTracker — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new EventTracker()).not.toThrow();
  });
});

describe("EventTracker.track()", () => {
  it("tracks an event without throwing", () => {
    expect(() => tracker.track("user.login", { userId: "u1" })).not.toThrow();
  });

  it("accepts event with source string", () => {
    expect(() =>
      tracker.track("agent.spawn", { agentId: "a1" }, "gateway")
    ).not.toThrow();
  });

  it("accepts event without source", () => {
    expect(() => tracker.track("test.event", {})).not.toThrow();
  });
});

describe("EventTracker.flush()", () => {
  it("flush() exists and is callable", () => {
    expect(typeof tracker.flush).toBe("function");
  });

  it("flush() does not throw with empty buffer", () => {
    expect(() => tracker.flush()).not.toThrow();
  });

  it("flush() does not throw after tracking events", () => {
    tracker.track("event.one", { data: 1 });
    tracker.track("event.two", { data: 2 });
    expect(() => tracker.flush()).not.toThrow();
  });
});
