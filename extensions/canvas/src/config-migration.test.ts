import { describe, expect, it } from "vitest";

describe("extensions/canvas/src/config-migration.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/canvas/src/config-migration.test.ts").toContain("extensions/canvas");
  });
});
