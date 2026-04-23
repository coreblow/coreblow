import { describe, it, expect } from "vitest";
import {
  resolveSimpleCompletionSelectionForAgent,
  prepareSimpleCompletionModel,
  prepareSimpleCompletionModelForAgent,
  completeWithPreparedSimpleCompletionModel,
} from "./simple-completion-runtime.js";

describe("simple-completion-runtime — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof resolveSimpleCompletionSelectionForAgent).toBe("function");
    expect(typeof prepareSimpleCompletionModel).toBe("function");
    expect(typeof prepareSimpleCompletionModelForAgent).toBe("function");
    expect(typeof completeWithPreparedSimpleCompletionModel).toBe("function");
  });
});
