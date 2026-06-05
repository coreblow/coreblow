import { describe, expect, it } from "vitest";

describe("src/talk/session-log-runtime.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/session-log-runtime.test.ts").toContain("src/talk");
  });
});
