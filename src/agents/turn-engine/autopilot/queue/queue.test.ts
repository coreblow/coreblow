import { beforeEach, describe, expect, it } from "vitest";
import { enqueue } from "./enqueue.js";
import { queueSize } from "./queue-size.js";
import { dequeue } from "./dequeue.js";
import { resetQueues } from "./reset-queues.js";

const SESSION = "test-session-wave2";

beforeEach(() => {
  resetQueues();
});

describe("queueSize()", () => {
  it("returns 0 for unknown session", () => {
    expect(queueSize("nonexistent-session")).toBe(0);
  });

  it("returns correct count after enqueue", () => {
    enqueue(SESSION, { role: "user", content: "hello" } as never);
    expect(queueSize(SESSION)).toBe(1);
  });

  it("increments on multiple enqueues", () => {
    enqueue(SESSION, { role: "user", content: "a" } as never);
    enqueue(SESSION, { role: "user", content: "b" } as never);
    expect(queueSize(SESSION)).toBe(2);
  });
});

describe("enqueue()", () => {
  it("returns a QueueItem with id and priority", () => {
    const item = enqueue(SESSION, { role: "user", content: "hi" } as never);
    expect(typeof item.id).toBe("string");
    expect(item.priority).toBe(0);
  });

  it("respects custom priority", () => {
    const item = enqueue(SESSION, { role: "user", content: "urgent" } as never, undefined, 10);
    expect(item.priority).toBe(10);
  });

  it("stores enqueuedAt timestamp", () => {
    const before = Date.now();
    const item = enqueue(SESSION, { role: "user", content: "ts" } as never);
    expect(item.enqueuedAt).toBeGreaterThanOrEqual(before);
  });

  it("sorts queue by priority descending", () => {
    const s = "priority-test";
    enqueue(s, { role: "user", content: "low" } as never, undefined, 1);
    enqueue(s, { role: "user", content: "high" } as never, undefined, 5);
    enqueue(s, { role: "user", content: "med" } as never, undefined, 3);
    const first = dequeue(s);
    expect(first?.priority).toBe(5);
  });
});

describe("dequeue()", () => {
  it("returns undefined for empty session", () => {
    expect(dequeue("empty-session")).toBeUndefined();
  });

  it("removes item from queue", () => {
    enqueue(SESSION, { role: "user", content: "msg" } as never);
    dequeue(SESSION);
    expect(queueSize(SESSION)).toBe(0);
  });

  it("returns the highest-priority item first", () => {
    enqueue(SESSION, { role: "user", content: "lo" } as never, undefined, 0);
    enqueue(SESSION, { role: "user", content: "hi" } as never, undefined, 99);
    const item = dequeue(SESSION);
    expect(item?.priority).toBe(99);
  });
});
