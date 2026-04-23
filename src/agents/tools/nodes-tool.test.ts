import { describe, it, expect } from "vitest";
import {
  createNodesTool,
} from "./nodes-tool.js";

describe("nodes-tool — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof createNodesTool).toBe("function");
  });
});
