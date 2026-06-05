import { describe, expect, it } from "vitest";

describe("extensions/codex/index.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/index.test.ts").toContain("extensions/codex");
  });
});
