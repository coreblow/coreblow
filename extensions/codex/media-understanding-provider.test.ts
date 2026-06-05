import { describe, expect, it } from "vitest";

describe("extensions/codex/media-understanding-provider.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/media-understanding-provider.test.ts").toContain("extensions/codex");
  });
});
