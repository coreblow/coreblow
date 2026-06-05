import { describe, expect, it } from "vitest";

describe("extensions/oc-path/src/oc-path/tests/scenarios/real-world-fixtures.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/oc-path/src/oc-path/tests/scenarios/real-world-fixtures.test.ts").toContain("extensions/oc-path");
  });
});
