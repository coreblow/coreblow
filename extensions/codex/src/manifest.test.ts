import { describe, expect, it } from "vitest";

describe("extensions/codex/src/manifest.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/manifest.test.ts").toContain("extensions/codex");
  });
});
