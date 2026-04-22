/**
 * src/observability/access-log.test.ts
 *
 * CoreBlow — Access Log Tests
 * Verifies AccessLog: log, getRecent, getByPath/User/Status, getStats, clear.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { AccessLog } from "./access-log.js";

let log: AccessLog;

beforeEach(() => {
  log = new AccessLog();
});

describe("AccessLog — log()", () => {
  it("returns an entry with correct fields", () => {
    const entry = log.log("GET", "/api/health", 200, 45);
    expect(entry.method).toBe("GET");
    expect(entry.path).toBe("/api/health");
    expect(entry.statusCode).toBe(200);
    expect(entry.durationMs).toBe(45);
    expect(entry.id).toMatch(/^acc-/);
  });

  it("increments count per call", () => {
    log.log("GET", "/a", 200, 10);
    log.log("POST", "/b", 201, 20);
    expect(log.count()).toBe(2);
  });

  it("accepts optional fields", () => {
    const entry = log.log("GET", "/me", 200, 30, { userId: "u1", ip: "127.0.0.1" });
    expect(entry.userId).toBe("u1");
    expect(entry.ip).toBe("127.0.0.1");
  });
});

describe("AccessLog — getRecent()", () => {
  it("returns last N entries", () => {
    for (let i = 0; i < 5; i++) log.log("GET", `/p${i}`, 200, i * 10);
    expect(log.getRecent(3)).toHaveLength(3);
  });

  it("returns all entries when limit > count", () => {
    log.log("GET", "/x", 200, 10);
    expect(log.getRecent(100)).toHaveLength(1);
  });
});

describe("AccessLog — getByPath()", () => {
  it("filters by exact path", () => {
    log.log("GET", "/api", 200, 10);
    log.log("POST", "/api", 201, 20);
    log.log("GET", "/other", 200, 5);
    expect(log.getByPath("/api")).toHaveLength(2);
  });

  it("returns empty array for unknown path", () => {
    expect(log.getByPath("/none")).toHaveLength(0);
  });
});

describe("AccessLog — getByUser()", () => {
  it("returns entries for specific user", () => {
    log.log("GET", "/u", 200, 10, { userId: "alice" });
    log.log("GET", "/u", 200, 10, { userId: "bob" });
    expect(log.getByUser("alice")).toHaveLength(1);
  });
});

describe("AccessLog — getByStatus()", () => {
  it("filters 4xx errors", () => {
    log.log("GET", "/ok", 200, 5);
    log.log("GET", "/bad", 404, 10);
    log.log("GET", "/error", 500, 20);
    expect(log.getByStatus(400, 499)).toHaveLength(1);
  });
});

describe("AccessLog — getStats()", () => {
  beforeEach(() => {
    log.log("GET", "/api", 200, 100);
    log.log("POST", "/api", 200, 200);
    log.log("GET", "/other", 404, 50);
  });

  it("counts totalRequests", () => {
    expect(log.getStats().totalRequests).toBe(3);
  });

  it("computes averageLatencyMs", () => {
    expect(log.getStats().averageLatencyMs).toBeCloseTo(116.67, 1);
  });

  it("computes errorRate for 4xx", () => {
    expect(log.getStats().errorRate).toBeCloseTo(1 / 3, 2);
  });

  it("lists topPaths", () => {
    const stats = log.getStats();
    expect(stats.topPaths[0]?.path).toBe("/api");
    expect(stats.topPaths[0]?.count).toBe(2);
  });

  it("aggregates statusCodes", () => {
    const stats = log.getStats();
    expect(stats.statusCodes[200]).toBe(2);
    expect(stats.statusCodes[404]).toBe(1);
  });
});

describe("AccessLog — clear()", () => {
  it("resets count to zero", () => {
    log.log("GET", "/x", 200, 10);
    log.clear();
    expect(log.count()).toBe(0);
  });
});
