import { describe, it, expect } from "vitest";
import {
  dispatchReplyFromConfig,
} from "./dispatch-from-config.js";

describe("dispatch-from-config — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof dispatchReplyFromConfig).toBe("function");
  });
});
