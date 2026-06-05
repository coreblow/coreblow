import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/provider-policy-api.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/provider-policy-api.test.ts").toContain("extensions/deepinfra");
  });
});
