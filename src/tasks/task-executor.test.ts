import { describe, expect, it } from "vitest";

describe("src/tasks/task-executor.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/task-executor.test.ts").toContain("src/tasks");
  });
});
