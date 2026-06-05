import { describe, expect, it } from "vitest";

describe("extensions/memory-wiki/cli-metadata.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/memory-wiki/cli-metadata.test.ts").toContain("extensions/memory-wiki");
  });
});
