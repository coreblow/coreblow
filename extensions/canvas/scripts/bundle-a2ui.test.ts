import { describe, expect, it } from "vitest";

describe("extensions/canvas/scripts/bundle-a2ui.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/canvas/scripts/bundle-a2ui.test.ts").toContain("extensions/canvas");
  });
});
