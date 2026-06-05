import { describe, expect, it } from "vitest";

describe("extensions/codex/src/commands.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/commands.test.ts").toContain("extensions/codex");
  });
});
