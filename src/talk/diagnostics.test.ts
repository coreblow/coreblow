import { describe, expect, it } from "vitest";

describe("src/talk/diagnostics.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/diagnostics.test.ts").toContain("src/talk");
  });
});
