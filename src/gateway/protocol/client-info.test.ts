import { describe, expect, it } from "vitest";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_NAMES } from "./client-info.js";

describe("GATEWAY_CLIENT_IDS", () => {
  it("is a non-null object", () => {
    expect(typeof GATEWAY_CLIENT_IDS).toBe("object");
    expect(GATEWAY_CLIENT_IDS).not.toBeNull();
  });

  it("is non-empty", () => {
    expect(Object.keys(GATEWAY_CLIENT_IDS).length).toBeGreaterThan(0);
  });

  it("all values are strings", () => {
    for (const val of Object.values(GATEWAY_CLIENT_IDS)) {
      expect(typeof val).toBe("string");
    }
  });
});

describe("GATEWAY_CLIENT_NAMES", () => {
  it("equals GATEWAY_CLIENT_IDS", () => {
    expect(GATEWAY_CLIENT_NAMES).toBe(GATEWAY_CLIENT_IDS);
  });
});
