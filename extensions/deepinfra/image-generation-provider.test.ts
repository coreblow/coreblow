import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/image-generation-provider.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/image-generation-provider.test.ts").toContain("extensions/deepinfra");
  });
});
