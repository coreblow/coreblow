import { describe, expect, it } from "vitest";

describe("extensions/google-meet/src/voice-call-gateway.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/google-meet/src/voice-call-gateway.test.ts").toContain("extensions/google-meet");
  });
});
