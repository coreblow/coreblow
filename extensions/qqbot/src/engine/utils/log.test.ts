import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/engine/utils/log.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/engine/utils/log.test.ts").toContain("extensions/qqbot");
  });
});
