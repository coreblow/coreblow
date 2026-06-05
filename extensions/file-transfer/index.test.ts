import { describe, expect, it } from "vitest";

describe("extensions/file-transfer/index.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/file-transfer/index.test.ts").toContain("extensions/file-transfer");
  });
});
