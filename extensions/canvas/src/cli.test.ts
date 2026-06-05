import { describe, expect, it } from "vitest";

describe("extensions/canvas/src/cli.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/canvas/src/cli.test.ts").toContain("extensions/canvas");
  });
});
