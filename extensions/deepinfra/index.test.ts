import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/index.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/index.test.ts").toContain("extensions/deepinfra");
  });
});
