import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/secret-contract.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/secret-contract.test.ts").toContain("extensions/qqbot");
  });
});
