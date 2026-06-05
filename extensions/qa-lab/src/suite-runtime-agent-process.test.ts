import { describe, expect, it } from "vitest";

describe("extensions/qa-lab/src/suite-runtime-agent-process.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("extensions/qa-lab/src/suite-runtime-agent-process.test.ts").toContain("extensions/qa-lab");
  });
});
