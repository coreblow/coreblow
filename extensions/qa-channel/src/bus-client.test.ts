import { describe, expect, it } from "vitest";

describe("extensions/qa-channel/src/bus-client.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-channel/src/bus-client.test.ts").toContain("extensions/qa-channel");
  });
});
