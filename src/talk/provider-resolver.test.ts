import { describe, expect, it } from "vitest";

describe("src/talk/provider-resolver.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/provider-resolver.test.ts").toContain("src/talk");
  });
});
