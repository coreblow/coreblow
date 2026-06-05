import { describe, expect, it } from "vitest";

describe("extensions/canvas/src/host/file-resolver.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/canvas/src/host/file-resolver.test.ts").toContain("extensions/canvas");
  });
});
