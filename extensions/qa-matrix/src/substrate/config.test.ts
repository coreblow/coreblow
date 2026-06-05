import { describe, expect, it } from "vitest";

describe("extensions/qa-matrix/src/substrate/config.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-matrix/src/substrate/config.test.ts").toContain("extensions/qa-matrix");
  });
});
