import { describe, expect, it } from "vitest";
import { GATEWAY_EVENT_UPDATE_AVAILABLE } from "./events.js";

describe("GATEWAY_EVENT_UPDATE_AVAILABLE", () => {
  it("is a non-empty string", () => {
    expect(typeof GATEWAY_EVENT_UPDATE_AVAILABLE).toBe("string");
    expect(GATEWAY_EVENT_UPDATE_AVAILABLE.length).toBeGreaterThan(0);
  });

  it("equals 'update.available'", () => {
    expect(GATEWAY_EVENT_UPDATE_AVAILABLE).toBe("update.available");
  });

  it("contains a dot separator", () => {
    expect(GATEWAY_EVENT_UPDATE_AVAILABLE).toContain(".");
  });

  it("follows event naming convention <category>.<action>", () => {
    const parts = GATEWAY_EVENT_UPDATE_AVAILABLE.split(".");
    expect(parts.length).toBe(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });
});
