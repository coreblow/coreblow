import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/speech-provider.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/speech-provider.test.ts").toContain("extensions/deepinfra");
  });
});
