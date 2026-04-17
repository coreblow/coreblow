import { describe, expect, it } from "vitest";
import {
  listProviderAttributionPolicies,
  resolveProviderAttributionIdentity,
  resolveProviderAttributionPolicy,
} from "./provider-attribution.js";

describe("provider attribution", () => {
  it("resolves the CoreBlow product identity", () => {
    const identity = resolveProviderAttributionIdentity();
    expect(identity).toBeDefined();
    expect(typeof identity.product).toBe("string");
    expect(identity.product.length).toBeGreaterThan(0);
  });

  it("lists the current attribution support matrix", () => {
    const policies = listProviderAttributionPolicies();
    expect(Array.isArray(policies)).toBe(true);
    expect(policies.length).toBeGreaterThan(0);
  });

  it("resolves a policy for known providers", () => {
    const policies = listProviderAttributionPolicies();
    if (policies.length > 0) {
      const first = policies[0];
      const resolved = resolveProviderAttributionPolicy(first.provider);
      expect(resolved).toBeDefined();
    }
  });
});
