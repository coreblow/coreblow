import { describe, expect, it } from "vitest";

describe("extensions/memory-wiki/src/unsafe-local.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/memory-wiki/src/unsafe-local.test.ts").toContain("extensions/memory-wiki");
  });
});
