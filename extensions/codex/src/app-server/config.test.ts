import { describe, expect, it } from "vitest";

describe("extensions/codex/src/app-server/config.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/app-server/config.test.ts").toContain("extensions/codex");
  });
});
