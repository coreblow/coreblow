import { describe, beforeEach, expect, it } from "vitest";
import { AnalyticsTracker } from "./analytics-tracker.js";

let tracker: AnalyticsTracker;

beforeEach(() => {
  tracker = new AnalyticsTracker();
});

describe("AnalyticsTracker — track()", () => {
  it("increments count after track", () => {
    tracker.track("login", "auth");
    expect(tracker.count()).toBe(1);
  });

  it("tracks multiple events", () => {
    tracker.track("msg.sent", "messaging", { userId: "u1", channel: "discord" });
    tracker.track("msg.sent", "messaging", { userId: "u2", channel: "slack" });
    expect(tracker.count()).toBe(2);
  });
});

describe("AnalyticsTracker — summarize()", () => {
  beforeEach(() => {
    tracker.track("login", "auth", { userId: "u1" });
    tracker.track("msg.sent", "messaging", { userId: "u1", channel: "discord" });
    tracker.track("msg.sent", "messaging", { userId: "u2", channel: "slack" });
  });

  it("returns correct totalEvents", () => {
    expect(tracker.summarize().totalEvents).toBe(3);
  });

  it("counts uniqueUsers correctly", () => {
    expect(tracker.summarize().uniqueUsers).toBe(2);
  });

  it("groups eventsByCategory", () => {
    const s = tracker.summarize();
    expect(s.eventsByCategory["auth"]).toBe(1);
    expect(s.eventsByCategory["messaging"]).toBe(2);
  });

  it("groups eventsByName", () => {
    const s = tracker.summarize();
    expect(s.eventsByName["msg.sent"]).toBe(2);
    expect(s.eventsByName["login"]).toBe(1);
  });

  it("lists topChannels", () => {
    const s = tracker.summarize();
    expect(s.topChannels.length).toBeGreaterThan(0);
  });
});

describe("AnalyticsTracker — countByName()", () => {
  it("returns 0 for unseen event", () => {
    expect(tracker.countByName("never")).toBe(0);
  });

  it("counts correctly", () => {
    tracker.track("click", "ui");
    tracker.track("click", "ui");
    expect(tracker.countByName("click")).toBe(2);
  });
});

describe("AnalyticsTracker — getUserEvents()", () => {
  it("returns events for specific user", () => {
    tracker.track("login", "auth", { userId: "alice" });
    tracker.track("login", "auth", { userId: "bob" });
    expect(tracker.getUserEvents("alice")).toHaveLength(1);
  });

  it("returns empty array for unknown user", () => {
    expect(tracker.getUserEvents("ghost")).toHaveLength(0);
  });
});

describe("AnalyticsTracker — export() / clear()", () => {
  it("export returns all events", () => {
    tracker.track("a", "b");
    tracker.track("c", "d");
    expect(tracker.export()).toHaveLength(2);
  });

  it("clear resets count to zero", () => {
    tracker.track("x", "y");
    tracker.clear();
    expect(tracker.count()).toBe(0);
  });
});
