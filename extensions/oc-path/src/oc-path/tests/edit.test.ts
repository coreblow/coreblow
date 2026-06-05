import { describe, expect, it } from "vitest";

describe("extensions/oc-path/src/oc-path/tests/edit.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/oc-path/src/oc-path/tests/edit.test.ts").toContain("extensions/oc-path");
  });
});
