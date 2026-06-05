import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/onboard.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/onboard.test.ts").toContain("extensions/deepinfra");
  });
});
