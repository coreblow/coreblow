import { describe, it, expect } from "vitest";
import {
  resolveEffectiveToolInventory,
} from "./tools-effective-inventory.js";

describe("tools-effective-inventory — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof resolveEffectiveToolInventory).toBe("function");
  });
});
