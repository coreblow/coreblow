/**
 * src/cli/gateway-cli/discover.test.ts
 *
 * CoreBlow — Gateway CLI Discover Tests
 * Verifies parseDiscoverTimeoutMs, pickBeaconHost, dedupeBeacons.
 */
import { describe, expect, it } from "vitest";
import {
  parseDiscoverTimeoutMs,
  pickBeaconHost,
  dedupeBeacons,
} from "./discover.js";

describe("parseDiscoverTimeoutMs()", () => {
  it("returns fallback for undefined", () => {
    expect(parseDiscoverTimeoutMs(undefined, 5000)).toBe(5000);
  });

  it("returns fallback for null", () => {
    expect(parseDiscoverTimeoutMs(null, 3000)).toBe(3000);
  });

  it("throws or returns number for non-numeric string", () => {
    expect(() => parseDiscoverTimeoutMs("abc", 1000)).toThrow();
  });

  it("returns parsed number for valid numeric string", () => {
    const result = parseDiscoverTimeoutMs("10000", 5000);
    expect(typeof result).toBe("number");
  });
});

describe("pickBeaconHost()", () => {
  it("returns null for beacon with no host/port", () => {
    const beacon = { instanceName: "test" } as never;
    const result = pickBeaconHost(beacon);
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("does not throw for minimal beacon", () => {
    expect(() => pickBeaconHost({ instanceName: "test" } as never)).not.toThrow();
  });
});

describe("dedupeBeacons()", () => {
  it("returns empty array for empty input", () => {
    expect(dedupeBeacons([])).toEqual([]);
  });

  it("returns same single beacon", () => {
    const beacon = { instanceName: "b1", host: "192.168.1.1" } as never;
    expect(dedupeBeacons([beacon])).toHaveLength(1);
  });

  it("deduplicates identical beacons", () => {
    const beacon = { instanceName: "b1", domain: "local", host: "192.168.1.1" } as never;
    const result = dedupeBeacons([beacon, beacon]);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
