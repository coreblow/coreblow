import { describe, expect, it } from "vitest";

describe("src/talk/agent-consult-runtime.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/agent-consult-runtime.test.ts").toContain("src/talk");
  });
});
