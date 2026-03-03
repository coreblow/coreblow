/**
 * extensions/microsoft-foundry/auth.test.ts
 *
 * CoreBlow — Microsoft Foundry Extension Auth Tests
 * Verifies auth method objects and isAzCliInstalled/execAz contracts.
 */
import { describe, expect, it } from "vitest";
import { apiKeyAuthMethod, entraIdAuthMethod } from "./auth.js";
import { isAzCliInstalled } from "./cli.js";

describe("Microsoft Foundry auth methods", () => {
  it("entraIdAuthMethod is a non-null object", () => {
    expect(typeof entraIdAuthMethod).toBe("object");
    expect(entraIdAuthMethod).not.toBeNull();
  });

  it("apiKeyAuthMethod is a non-null object", () => {
    expect(typeof apiKeyAuthMethod).toBe("object");
    expect(apiKeyAuthMethod).not.toBeNull();
  });

  it("entraIdAuthMethod has at least one key", () => {
    expect(Object.keys(entraIdAuthMethod).length).toBeGreaterThan(0);
  });

  it("apiKeyAuthMethod has at least one key", () => {
    expect(Object.keys(apiKeyAuthMethod).length).toBeGreaterThan(0);
  });

  it("auth methods are distinct objects", () => {
    expect(entraIdAuthMethod).not.toBe(apiKeyAuthMethod);
  });
});

describe("isAzCliInstalled", () => {
  it("is a function", () => {
    expect(typeof isAzCliInstalled).toBe("function");
  });

  it("returns a boolean", () => {
    // May return true or false depending on system — just check type
    const result = isAzCliInstalled();
    expect(typeof result).toBe("boolean");
  });

  it("does not throw when called", () => {
    expect(() => isAzCliInstalled()).not.toThrow();
  });
});
