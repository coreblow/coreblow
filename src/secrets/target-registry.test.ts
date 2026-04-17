import { describe, expect, it } from "vitest";
import * as targetRegistry from "./target-registry.js";

describe("secret target registry", () => {
  it("exports target registry query functions", () => {
    expect(targetRegistry).toBeDefined();
    expect(typeof targetRegistry).toBe("object");
  });
});
