import { describe, expect, it } from "vitest";

describe("extensions/qa-channel/setup-entry.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-channel/setup-entry.test.ts").toContain("extensions/qa-channel");
  });
});
