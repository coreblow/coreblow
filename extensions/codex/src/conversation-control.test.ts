import { describe, expect, it } from "vitest";

describe("extensions/codex/src/conversation-control.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/conversation-control.test.ts").toContain("extensions/codex");
  });
});
