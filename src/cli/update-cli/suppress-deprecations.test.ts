/**
 * src/cli/update-cli/suppress-deprecations.test.ts
 *
 * CoreBlow — Suppress Deprecations Tests
 * Verifies suppressDeprecations: runs without throwing, sets NODE_NO_WARNINGS.
 */
import { describe, expect, it } from "vitest";
import { suppressDeprecations } from "./suppress-deprecations.js";

describe("suppressDeprecations()", () => {
  it("is a function", () => {
    expect(typeof suppressDeprecations).toBe("function");
  });

  it("does not throw", () => {
    expect(() => suppressDeprecations()).not.toThrow();
  });

  it("sets NODE_NO_WARNINGS=1 in process.env", () => {
    suppressDeprecations();
    expect(process.env.NODE_NO_WARNINGS).toBe("1");
  });

  it("is idempotent (safe to call multiple times)", () => {
    expect(() => {
      suppressDeprecations();
      suppressDeprecations();
    }).not.toThrow();
  });
});
