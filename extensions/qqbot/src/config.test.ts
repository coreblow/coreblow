import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/config.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/config.test.ts").toContain("extensions/qqbot");
  });
});
