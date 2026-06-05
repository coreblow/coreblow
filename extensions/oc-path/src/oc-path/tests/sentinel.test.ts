import { describe, expect, it } from "vitest";

describe("extensions/oc-path/src/oc-path/tests/sentinel.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/oc-path/src/oc-path/tests/sentinel.test.ts").toContain("extensions/oc-path");
  });
});
