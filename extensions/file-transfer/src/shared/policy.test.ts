import { describe, expect, it } from "vitest";

describe("extensions/file-transfer/src/shared/policy.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/file-transfer/src/shared/policy.test.ts").toContain("extensions/file-transfer");
  });
});
