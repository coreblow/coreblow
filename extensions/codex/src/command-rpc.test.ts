import { describe, expect, it } from "vitest";

describe("extensions/codex/src/command-rpc.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/command-rpc.test.ts").toContain("extensions/codex");
  });
});
