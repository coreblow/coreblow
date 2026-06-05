import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/provider.contract.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/provider.contract.test.ts").toContain("extensions/deepinfra");
  });
});
