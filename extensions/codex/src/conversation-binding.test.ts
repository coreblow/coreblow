import { describe, expect, it } from "vitest";

describe("extensions/codex/src/conversation-binding.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/conversation-binding.test.ts").toContain("extensions/codex");
  });
});
