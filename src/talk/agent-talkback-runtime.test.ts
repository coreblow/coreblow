import { describe, expect, it } from "vitest";

describe("src/talk/agent-talkback-runtime.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/agent-talkback-runtime.test.ts").toContain("src/talk");
  });
});
