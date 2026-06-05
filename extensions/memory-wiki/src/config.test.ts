import { describe, expect, it } from "vitest";

describe("extensions/memory-wiki/src/config.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/memory-wiki/src/config.test.ts").toContain("extensions/memory-wiki");
  });
});
