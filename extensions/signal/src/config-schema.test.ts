import { describe, expect, it } from "vitest";
import { SignalConfigSchema } from "../config-api.js";

describe("Signal config schema", () => {
  it("accepts channel apiMode and rejects it per account", () => {
    for (const apiMode of ["auto", "native", "container"] as const) {
      expect(SignalConfigSchema.safeParse({ apiMode }).success).toBe(true);
    }
    expect(
      SignalConfigSchema.safeParse({ accounts: { work: { apiMode: "container" } } }).success,
    ).toBe(false);
  });
});
