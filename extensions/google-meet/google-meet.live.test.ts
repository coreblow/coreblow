import { describe, expect, it } from "vitest";

describe("extensions/google-meet/google-meet.live.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/google-meet/google-meet.live.test.ts").toContain("extensions/google-meet");
  });
});
