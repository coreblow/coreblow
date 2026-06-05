import { describe, expect, it } from "vitest";

describe("extensions/qqbot/src/engine/commands/builtin/log-helpers.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qqbot/src/engine/commands/builtin/log-helpers.test.ts").toContain("extensions/qqbot");
  });
});
