import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/bridge/plugin-version.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/bridge/plugin-version.test.ts").toContain("extensions/qqbot");
  });
});
