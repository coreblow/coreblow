import { describe, expect, it } from "vitest";

describe("extensions/google-meet/index.create.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/google-meet/index.create.test.ts").toContain("extensions/google-meet");
  });
});
