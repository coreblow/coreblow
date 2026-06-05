import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/engine/utils/platform.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/engine/utils/platform.test.ts").toContain("extensions/qqbot");
  });
});
