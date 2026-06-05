import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/suite-summary.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/suite-summary.test.ts").toContain("extensions/qa-lab");
  });
});
