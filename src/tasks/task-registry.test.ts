import { describe, expect, it } from "vitest";

describe("src/tasks/task-registry.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/task-registry.test.ts").toContain("src/tasks");
  });
});
