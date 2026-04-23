import { describe, it, expect } from "vitest";
import {
  buildPinnedWritePlan,
  buildPinnedMkdirpPlan,
  buildPinnedRemovePlan,
  buildPinnedRenamePlan,
  SANDBOX_PINNED_MUTATION_PYTHON,
} from "./fs-bridge-mutation-helper.js";

describe("fs-bridge-mutation-helper — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof buildPinnedWritePlan).toBe("function");
    expect(typeof buildPinnedMkdirpPlan).toBe("function");
    expect(typeof buildPinnedRemovePlan).toBe("function");
    expect(typeof buildPinnedRenamePlan).toBe("function");
    expect(SANDBOX_PINNED_MUTATION_PYTHON).toBeDefined();
  });
});
