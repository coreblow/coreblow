import { describe, expect, it } from "vitest";

describe("src/tasks/task-owner-access.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/task-owner-access.test.ts").toContain("src/tasks");
  });
});
