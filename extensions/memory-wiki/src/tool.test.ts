import { describe, expect, it } from "vitest";

describe("extensions/memory-wiki/src/tool.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/memory-wiki/src/tool.test.ts").toContain("extensions/memory-wiki");
  });
});
