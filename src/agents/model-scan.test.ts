import { describe, it, expect } from "vitest";
import {
  scanOpenRouterModels,
} from "./model-scan.js";

describe("model-scan — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof scanOpenRouterModels).toBe("function");
  });
});
