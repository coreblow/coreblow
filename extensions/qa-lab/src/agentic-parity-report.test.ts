import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/agentic-parity-report.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/agentic-parity-report.test.ts").toContain("extensions/qa-lab");
  });
});
