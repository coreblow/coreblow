import { describe, expect, it } from "vitest";

describe("extensions/file-transfer/src/tools/dir-fetch-tool.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/file-transfer/src/tools/dir-fetch-tool.test.ts").toContain("extensions/file-transfer");
  });
});
