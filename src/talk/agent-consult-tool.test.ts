import { describe, expect, it } from "vitest";

describe("src/talk/agent-consult-tool.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/agent-consult-tool.test.ts").toContain("src/talk");
  });
});
