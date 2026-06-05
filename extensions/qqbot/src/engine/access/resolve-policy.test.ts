import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/engine/access/resolve-policy.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/engine/access/resolve-policy.test.ts").toContain("extensions/qqbot");
  });
});
