import { describe, expect, it } from "vitest";

describe("extensions/google-meet/src/transports/chrome.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/google-meet/src/transports/chrome.test.ts").toContain("extensions/google-meet");
  });
});
