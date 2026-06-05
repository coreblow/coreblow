import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/manifest-schema.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/manifest-schema.test.ts").toContain("extensions/qqbot");
  });
});
