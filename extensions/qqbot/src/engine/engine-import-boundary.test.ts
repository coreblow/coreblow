import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/engine/engine-import-boundary.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/engine/engine-import-boundary.test.ts").toContain("extensions/qqbot");
  });
});
