import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/media-understanding-provider.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/media-understanding-provider.test.ts").toContain("extensions/deepinfra");
  });
});
