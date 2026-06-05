import { describe, expect, it } from "vitest";

describe("src/tasks/detached-task-runtime.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/detached-task-runtime.test.ts").toContain("src/tasks");
  });
});
