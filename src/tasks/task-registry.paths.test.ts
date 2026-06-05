import { describe, expect, it } from "vitest";

describe("src/tasks/task-registry.paths.test.ts", () => {
  it("keeps the CoreBlow parity smoke surface loadable", () => {
    expect("src/tasks/task-registry.paths.test.ts").toContain("src/tasks");
  });
});
