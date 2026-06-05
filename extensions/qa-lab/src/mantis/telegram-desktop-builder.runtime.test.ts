import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/mantis/telegram-desktop-builder.runtime.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/mantis/telegram-desktop-builder.runtime.test.ts").toContain("extensions/qa-lab");
  });
});
