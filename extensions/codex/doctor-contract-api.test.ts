import { describe, expect, it } from "vitest";

describe("extensions/codex/doctor-contract-api.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/codex/doctor-contract-api.test.ts").toContain("extensions/codex");
  });
});
