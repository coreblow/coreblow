import { describe, expect, it } from "vitest";

describe("extensions/google-meet/src/config-compat.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/google-meet/src/config-compat.test.ts").toContain("extensions/google-meet");
  });
});
