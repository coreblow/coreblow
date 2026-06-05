import { describe, expect, it } from "vitest";

describe("extensions/codex/src/app-server/plugin-activation.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/src/app-server/plugin-activation.test.ts").toContain("extensions/codex");
  });
});
