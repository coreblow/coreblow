import { describe, expect, it } from "vitest";
import { clearLineRuntimeStateForTests, getLineRuntimeState } from "./monitor.js";

describe("line monitor durable state", () => {
  it("clears runtime state for tests", () => {
    clearLineRuntimeStateForTests();
    expect(getLineRuntimeState("default")).toBeUndefined();
  });
});
