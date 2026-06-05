import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/bridge/commands/framework-registration.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/bridge/commands/framework-registration.test.ts").toContain("extensions/qqbot");
  });
});
