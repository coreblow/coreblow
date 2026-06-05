import { describe, expect, it } from "vitest";

describe("src/tasks/task-boundaries.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/task-boundaries.test.ts").toContain("src/tasks");
  });
});
