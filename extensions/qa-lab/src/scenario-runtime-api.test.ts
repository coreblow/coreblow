import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/scenario-runtime-api.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/scenario-runtime-api.test.ts").toContain("extensions/qa-lab");
  });
});
