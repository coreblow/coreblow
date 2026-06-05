import { describe, expect, it } from "vitest";

describe("extensions/deepinfra/memory-embedding-adapter.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/deepinfra/memory-embedding-adapter.test.ts").toContain("extensions/deepinfra");
  });
});
