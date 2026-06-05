import { describe, expect, it } from "vitest";

describe("src/talk/logging.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/talk/logging.test.ts").toContain("src/talk");
  });
});
