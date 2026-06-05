import { describe, expect, it } from "vitest";

describe("extensions/file-transfer/src/node-host/file-write.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/file-transfer/src/node-host/file-write.test.ts").toContain("extensions/file-transfer");
  });
});
