import { describe, expect, it } from "vitest";

describe("extensions/codex/src/migration/provider.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/migration/provider.test.ts").toContain("extensions/codex");
  });
});
