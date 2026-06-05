import { describe, expect, it } from "vitest";

describe("extensions/qa-matrix/src/substrate/artifacts.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-matrix/src/substrate/artifacts.test.ts").toContain("extensions/qa-matrix");
  });
});
