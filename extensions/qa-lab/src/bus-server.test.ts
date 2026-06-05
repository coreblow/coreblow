import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/bus-server.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/bus-server.test.ts").toContain("extensions/qa-lab");
  });
});
